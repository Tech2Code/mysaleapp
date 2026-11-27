"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { logAdminAction } from "@/features/security/audit"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { CACHE_TAGS } from "./queries"
import { categorySchema, productReviewSchema, productSchema, stockAlertSchema, type ProductValues } from "./schema"
import type { ProductReview } from "./types"

function toRow(p: ProductValues) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stock is applied separately, as a delta
  const { stock: _stock, ...rest } = toRowWithStock(p)
  return rest
}

function toRowWithStock(p: ProductValues) {
  const hasVariants = p.variants.length > 0
  const effectiveStock = hasVariants ? p.variants.reduce((sum, vr) => sum + vr.stock, 0) : p.stock
  const inStockVariants = p.variants.filter((vr) => vr.stock > 0)
  const pricePool = inStockVariants.length > 0 ? inStockVariants : p.variants
  const lowestVariant = hasVariants
    ? pricePool.reduce((best, cur) => (cur.price < best.price ? cur : best), pricePool[0])
    : null
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: lowestVariant ? lowestVariant.price : p.price,
    compare_at_price: lowestVariant ? (lowestVariant.compareAtPrice ?? null) : (p.compareAtPrice ?? null),
    images: p.images,
    category_id: p.categoryId ?? null,
    stock: effectiveStock,
    variants: p.variants.map((vr) => ({
      id: vr.id,
      label: vr.label,
      ...(vr.options && Object.keys(vr.options).length > 0 ? { options: vr.options } : {}),
      price: vr.price,
      compareAtPrice: vr.compareAtPrice ?? null,
      stock: vr.stock,
      sku: vr.sku ?? null,
    })),
    weight_grams: p.weightGrams,
    shipping_class: p.shippingClass,
    return_window_days: p.returnWindowDays ?? null,
    fees: [],
    short_description: p.shortDescription,
    highlights: p.highlights,
    specs: p.specs,
    care_instructions: p.careInstructions,
    review_aspects: p.reviewAspects.length > 0 ? p.reviewAspects : null,
    is_active: p.isActive,
    is_featured: p.isFeatured,
    seo_title: p.seoTitle || null,
    seo_description: p.seoDescription || null,
  }
}

function friendlyDbError(message: string, code?: string): string {
  if (code === "23505" || message.includes("duplicate key")) {
    return "That URL slug is already used by another item. Please change it."
  }
  return "Could not save. Please try again."
}

function extractStoragePaths(urls: readonly string[]): string[] {
  const prefix = "/storage/v1/object/public/product-images/"
  const out: string[] = []
  for (const raw of urls) {
    try {
      const pathname = new URL(raw).pathname
      if (!pathname.startsWith(prefix)) continue
      const key = decodeURIComponent(pathname.slice(prefix.length))
      if (key && !key.split("/").some((seg) => seg === "." || seg === ".." || seg === "")) out.push(key)
    } catch {}
  }
  return out
}

/** Storefront and admin pages are refreshed instantly after any catalogue change. */
function refreshCatalogue() {
  updateTag(CACHE_TAGS.products)
  updateTag(CACHE_TAGS.categories)
  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
}

function refreshReviews() {
  updateTag(CACHE_TAGS.products)
  revalidatePath("/products", "layout")
  revalidatePath("/account/orders", "layout")
}

/**
 * `expectedStock` is the stock the form was loaded with. On edit the server applies the admin's
 * change as a delta to the CURRENT stock (customers reserve stock when ordering, so overwriting with
 * an absolute number could erase a reservation). The result carries the stock after saving.
 */
export async function saveProduct(
  id: string | null,
  input: unknown,
  expectedStock?: number
): Promise<ActionResult<{ id: string; stock: number }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  if (id !== null && !z.uuid().safeParse(id).success) return fail("Invalid product")
  const parsed = productSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const supabase = await getServerSupabase()

  const insertPayload = toRowWithStock(parsed.data)
  if (!id) {
    let { data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select("id, stock")
      .single<{ id: string; stock: number }>()
    // Backward-compatible fallback if migration 0069 (variants column) is not yet pushed and no variants were added
    if (error && parsed.data.variants.length === 0 && /variants/i.test(error.message)) {
      const { variants: _ignored, ...fallbackInsert } = insertPayload
      void _ignored
      const retry = await supabase.from("products").insert(fallbackInsert).select("id, stock").single<{ id: string; stock: number }>()
      data = retry.data
      error = retry.error
    }
    if (error || !data) return fail(friendlyDbError(error?.message ?? "", error?.code))
    await logAdminAction(supabase, {
      actorId: auth.user.id,
      action: "product.create",
      targetType: "product",
      targetId: data.id,
      metadata: { slug: parsed.data.slug, name: parsed.data.name, stock: data.stock },
    })
    refreshCatalogue()
    return { ok: true, data: { id: data.id, stock: data.stock } }
  }

  const { data: before } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .maybeSingle<{ images: string[] }>()

  const updatePayload = toRow(parsed.data)
  let { data, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select("id, stock")
    .single<{ id: string; stock: number }>()
  if (error && parsed.data.variants.length === 0 && /variants/i.test(error.message)) {
    const { variants: _ignored, ...fallbackUpdate } = updatePayload
    void _ignored
    const retry = await supabase.from("products").update(fallbackUpdate).eq("id", id).select("id, stock").single<{ id: string; stock: number }>()
    data = retry.data
    error = retry.error
  }
  if (error || !data) return fail(friendlyDbError(error?.message ?? "", error?.code))

  const kept = new Set(parsed.data.images)
  const removedPaths = extractStoragePaths((before?.images ?? []).filter((u) => !kept.has(u)))
  if (removedPaths.length) {
    await supabase.storage.from("product-images").remove(removedPaths)
  }

  let stock = data.stock
  const hasVariants = parsed.data.variants.length > 0
  if (hasVariants) {
    const variantTotalStock = parsed.data.variants.reduce((sum, vr) => sum + vr.stock, 0)
    const variantDelta = variantTotalStock - data.stock
    if (variantDelta !== 0) {
      const { data: after, error: stockError } = await supabase.rpc("adjust_product_stock", { p_id: id, p_delta: variantDelta })
      if (!stockError) stock = Number(after)
    }
    if (data.stock <= 0 && stock > 0) {
      await supabase.from("products").update({ restocked_at: new Date().toISOString() }).eq("id", id)
    }
  }
  const expected = Number.isInteger(expectedStock) ? (expectedStock as number) : null
  const delta = hasVariants || expected === null ? 0 : parsed.data.stock - expected
  if (delta !== 0) {
    const { data: after, error: stockError } = await supabase.rpc("adjust_product_stock", { p_id: id, p_delta: delta })
    if (stockError) {
      refreshCatalogue()
      return fail("Saved, but the stock could not be updated. Please try again.")
    }
    stock = Number(after)
    if (data.stock <= 0 && stock > 0) {
      // Best-effort stamp restocked_at if migration 0068 column exists without trigger
      await supabase.from("products").update({ restocked_at: new Date().toISOString() }).eq("id", id)
    }
  }

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "product.update",
    targetType: "product",
    targetId: data.id,
    metadata: { slug: parsed.data.slug, stockDelta: delta, stockAfter: stock },
  })
  refreshCatalogue()
  return { ok: true, data: { id: data.id, stock } }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  if (!z.uuid().safeParse(id).success) return fail("Invalid product")

  const supabase = await getServerSupabase()
  const { data: product } = await supabase
    .from("products")
    .select("images")
    .eq("id", id)
    .maybeSingle<{ images: string[] }>()

  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) return fail("Could not delete product")

  // Best-effort cleanup of the product's photos in Storage.
  const paths = extractStoragePaths(product?.images ?? [])
  if (paths.length) await supabase.storage.from("product-images").remove(paths)

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "product.delete",
    targetType: "product",
    targetId: id,
  })
  refreshReviews()
  return { ok: true }
}

const flagSchema = z.enum(["isActive", "isFeatured"])

export async function toggleProductFlag(
  id: string,
  flag: "isActive" | "isFeatured",
  value: boolean
): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsedFlag = flagSchema.safeParse(flag)
  const parsedValue = z.boolean().safeParse(value)
  if (!z.uuid().safeParse(id).success || !parsedFlag.success || !parsedValue.success) {
    return fail("Invalid product")
  }

  const supabase = await getServerSupabase()
  const column = parsedFlag.data === "isActive" ? "is_active" : "is_featured"
  const { error } = await supabase
    .from("products")
    .update({ [column]: parsedValue.data })
    .eq("id", id)
  if (error) return fail("Could not update product")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "product.toggle_flag",
    targetType: "product",
    targetId: id,
    metadata: { flag: parsedFlag.data, value: parsedValue.data },
  })
  refreshReviews()
  return { ok: true }
}

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  if (id !== null && !z.uuid().safeParse(id).success) return fail("Invalid category")
  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const categoryRow = {
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    sort: parsed.data.sort,
    review_aspects: parsed.data.reviewAspects.length > 0 ? parsed.data.reviewAspects : null,
  }

  const supabase = await getServerSupabase()
  const { error } = id
    ? await supabase.from("categories").update(categoryRow).eq("id", id)
    : await supabase.from("categories").insert(categoryRow)
  if (error) return fail(friendlyDbError(error.message, error.code))

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: id ? "category.update" : "category.create",
    targetType: "category",
    targetId: id ?? parsed.data.slug,
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  })
  refreshReviews()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  if (!z.uuid().safeParse(id).success) return fail("Invalid category")

  const supabase = await getServerSupabase()
  // Products in this category are kept; their category is set to null (FK rule).
  const { error } = await supabase.from("categories").delete().eq("id", id)
  if (error) return fail("Could not delete category")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "category.delete",
    targetType: "category",
    targetId: id,
  })
  refreshReviews()
  return { ok: true }
}

export async function getMyProductReviewState(
  productId: string
): Promise<{ canReview: boolean; isAdmin: boolean; myReview: ProductReview | null }> {
  if (!z.uuid().safeParse(productId).success) {
    return { canReview: false, isAdmin: false, myReview: null }
  }
  const supabase = await getServerSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sessionUserId = session?.user?.id
  if (!sessionUserId) return { canReview: false, isAdmin: false, myReview: null }

  const [userRes, canRes, isAdminRes, myRowRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("can_review_product", { p_product_id: productId }),
    supabase.rpc("is_admin"),
    supabase
      .from("product_reviews")
      .select("id, product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at")
      .eq("product_id", productId)
      .eq("user_id", sessionUserId)
      .maybeSingle<{
        id: string
        product_id: string
        user_id: string
        reviewer_name: string
        rating: number
        title: string | null
        comment: string
        is_verified_purchase: boolean
        created_at: string
        updated_at: string
      }>(),
  ])

  const user = userRes.data.user
  if (!user || user.id !== sessionUserId) {
    return { canReview: false, isAdmin: false, myReview: null }
  }

  const r = myRowRes.data
  return {
    canReview: Boolean(canRes.data),
    isAdmin: Boolean(isAdminRes.data),
    myReview: r
      ? {
          id: r.id,
          productId: r.product_id,
          userId: r.user_id,
          reviewerName: r.reviewer_name,
          rating: Number(r.rating),
          title: r.title,
          comment: r.comment,
          isVerifiedPurchase: Boolean(r.is_verified_purchase),
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }
      : null,
  }
}

export async function getMyReviewEligibilitySnapshot(): Promise<{
  isAdmin: boolean
  deliveredProductIds: string[]
  reviews: ProductReview[]
} | null> {
  const supabase = await getServerSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const sessionUserId = session?.user?.id
  if (!sessionUserId) return null

  const [userRes, isAdminRes, ordersRes, reviewsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("is_admin"),
    supabase
      .from("orders")
      .select("items")
      .eq("user_id", sessionUserId)
      .eq("status", "delivered"),
    supabase
      .from("product_reviews")
      .select("id, product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at")
      .eq("user_id", sessionUserId),
  ])

  const user = userRes.data.user
  if (!user || user.id !== sessionUserId) return null

  const deliveredSet = new Set<string>()
  for (const row of (ordersRes.data ?? []) as { items?: { productId?: string }[] | null }[]) {
    if (!Array.isArray(row.items)) continue
    for (const item of row.items) {
      if (item && typeof item.productId === "string" && item.productId) {
        deliveredSet.add(item.productId)
      }
    }
  }

  const reviews: ProductReview[] = (
    (reviewsRes.data ?? []) as {
      id: string
      product_id: string
      user_id: string
      reviewer_name: string
      rating: number
      title: string | null
      comment: string
      is_verified_purchase: boolean
      created_at: string
      updated_at: string
    }[]
  ).map((r) => ({
    id: r.id,
    productId: r.product_id,
    userId: r.user_id,
    reviewerName: r.reviewer_name,
    rating: Number(r.rating),
    title: r.title,
    comment: r.comment,
    isVerifiedPurchase: Boolean(r.is_verified_purchase),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return {
    isAdmin: Boolean(isAdminRes.data),
    deliveredProductIds: Array.from(deliveredSet),
    reviews,
  }
}

export async function submitProductReview(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = productReviewSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted review fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Please sign in to write a review.")
  if (await limited("place-order", `review:${user.id}`)) return fail(RATE_LIMIT_MESSAGE)

  const { data, error } = await supabase.rpc("upsert_product_review", {
    p_product_id: parsed.data.productId,
    p_rating: parsed.data.rating,
    p_title: parsed.data.title ?? null,
    p_comment: parsed.data.comment,
  })

  if (error) {
    if (error.message.includes("NOT_VERIFIED_BUYER")) {
      return fail("Only customers with a delivered order for this item can submit a review.")
    }
    if (error.message.includes("NOT_SIGNED_IN")) {
      return fail("Please sign in to write a review.")
    }
    if (error.message.includes("ITEM_UNAVAILABLE")) {
      return fail("This product is no longer available for review.")
    }
    return fail("Could not save your review. Please try again.")
  }

  refreshReviews()
  const res = data as { id?: string } | null
  return { ok: true, data: { id: res?.id ?? "" } }
}

const deleteReviewSchema = z.object({
  reviewId: z.uuid(),
  productId: z.uuid(),
})

export async function deleteProductReview(input: unknown): Promise<ActionResult> {
  const parsed = deleteReviewSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Invalid review.")
  }
  const { reviewId, productId } = parsed.data

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Please sign in.")
  if (await limited("place-order", `review-del:${user.id}`)) return fail(RATE_LIMIT_MESSAGE)

  const { data: target } = await supabase
    .from("product_reviews")
    .select("id, user_id")
    .eq("id", reviewId)
    .eq("product_id", productId)
    .maybeSingle<{ id: string; user_id: string }>()

  if (!target) return fail("Review not found.")

  if (target.user_id !== user.id) {
    const auth = await assertAdmin()
    if (!auth.ok) return fail(auth.error)
  }

  const { data: deleted, error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("product_id", productId)
    .select("id, user_id")

  if (error || !deleted || deleted.length === 0) return fail("Could not delete review.")

  if (deleted[0].user_id !== user.id) {
    await logAdminAction(supabase, {
      actorId: user.id,
      action: "review.delete",
      targetType: "product",
      targetId: productId,
      metadata: { reviewId },
    })
  }

  refreshReviews()
  return { ok: true }
}

/** Subscribe a customer's WhatsApp/mobile number to be notified when a sold-out product is restocked. */
export async function subscribeStockAlert(
  input: unknown
): Promise<ActionResult<{ alreadySubscribed: boolean }>> {
  const parsed = stockAlertSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please enter a valid 10-digit WhatsApp / mobile number.", z.flattenError(parsed.error).fieldErrors)
  }
  const { productId, name, phone } = parsed.data
  if (await limited("place-order", `stock-alert:${phone}`)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("subscribe_stock_alert", {
    p_product_id: productId,
    p_name: name ?? "",
    p_phone: phone,
  })
  if (error) {
    if (error.message.includes("ALREADY_IN_STOCK")) {
      refreshCatalogue()
      return fail("Good news! This item is already back in stock — refresh to order.")
    }
    if (error.message.includes("PRODUCT_NOT_FOUND")) {
      return fail("This product is no longer available.")
    }
    if (error.message.includes("INVALID_PHONE")) {
      return fail("Please enter a valid 10-digit mobile number.", { phone: ["Enter a valid 10-digit mobile number"] })
    }
    return fail("Could not save your alert right now. Please try again shortly.")
  }

  const res = data as { alreadySubscribed?: boolean } | null
  revalidatePath("/admin/products")
  return { ok: true, data: { alreadySubscribed: Boolean(res?.alreadySubscribed) } }
}

export async function markStockAlertNotified(alertId: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  if (!z.uuid().safeParse(alertId).success) return fail("Invalid alert")

  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from("stock_alerts")
    .update({ status: "notified", notified_at: new Date().toISOString() })
    .eq("id", alertId)
  if (error) return fail("Could not update alert status.")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "stock_alert.notified",
    targetType: "product",
    targetId: alertId,
  })
  revalidatePath("/admin/products")
  return { ok: true }
}

export async function deleteStockAlert(alertId: string): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  if (!z.uuid().safeParse(alertId).success) return fail("Invalid alert")

  const supabase = await getServerSupabase()
  const { error } = await supabase.from("stock_alerts").delete().eq("id", alertId)
  if (error) return fail("Could not remove alert.")

  revalidatePath("/admin/products")
  return { ok: true }
}

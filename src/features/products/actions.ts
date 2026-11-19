"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { logAdminAction } from "@/features/security/audit"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { CACHE_TAGS } from "./queries"
import { categorySchema, productReviewSchema, productSchema, type ProductValues } from "./schema"
import type { ProductReview } from "./types"

function toRow(p: ProductValues) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stock is applied separately, as a delta
  const { stock: _stock, ...rest } = toRowWithStock(p)
  return rest
}

function toRowWithStock(p: ProductValues) {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compare_at_price: p.compareAtPrice ?? null,
    images: p.images,
    category_id: p.categoryId ?? null,
    stock: p.stock,
    weight_grams: p.weightGrams,
    shipping_class: p.shippingClass,
    fees: [],
    short_description: p.shortDescription,
    highlights: p.highlights,
    specs: p.specs,
    care_instructions: p.careInstructions,
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

  if (!id) {
    const { data, error } = await supabase
      .from("products")
      .insert(toRowWithStock(parsed.data))
      .select("id, stock")
      .single<{ id: string; stock: number }>()
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

  const { data, error } = await supabase
    .from("products")
    .update(toRow(parsed.data))
    .eq("id", id)
    .select("id, stock")
    .single<{ id: string; stock: number }>()
  if (error || !data) return fail(friendlyDbError(error?.message ?? "", error?.code))

  const kept = new Set(parsed.data.images)
  const removedPaths = extractStoragePaths((before?.images ?? []).filter((u) => !kept.has(u)))
  if (removedPaths.length) {
    await supabase.storage.from("product-images").remove(removedPaths)
  }

  let stock = data.stock
  const expected = Number.isInteger(expectedStock) ? (expectedStock as number) : null
  const delta = expected === null ? 0 : parsed.data.stock - expected
  if (delta !== 0) {
    const { data: after, error: stockError } = await supabase.rpc("adjust_product_stock", { p_id: id, p_delta: delta })
    if (stockError) {
      refreshCatalogue()
      return fail("Saved, but the stock could not be updated. Please try again.")
    }
    stock = Number(after)
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
  refreshCatalogue()
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
  refreshCatalogue()
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

  const supabase = await getServerSupabase()
  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data)
  if (error) return fail(friendlyDbError(error.message, error.code))

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: id ? "category.update" : "category.create",
    targetType: "category",
    targetId: id ?? parsed.data.slug,
    metadata: { name: parsed.data.name, slug: parsed.data.slug },
  })
  refreshCatalogue()
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
  refreshCatalogue()
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
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { canReview: false, isAdmin: false, myReview: null }

  const [canRes, isAdminRes, myRowRes] = await Promise.all([
    supabase.rpc("can_review_product", { p_product_id: productId }),
    supabase.rpc("is_admin"),
    supabase
      .from("product_reviews")
      .select("id, product_id, user_id, reviewer_name, rating, title, comment, is_verified_purchase, created_at, updated_at")
      .eq("product_id", productId)
      .eq("user_id", user.id)
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
    return fail("Could not save your review. Please try again.")
  }

  refreshCatalogue()
  const res = data as { id?: string } | null
  return { ok: true, data: { id: res?.id ?? "" } }
}

export async function deleteProductReview(input: { reviewId: string; productId: string }): Promise<ActionResult> {
  if (!z.uuid().safeParse(input.reviewId).success || !z.uuid().safeParse(input.productId).success) {
    return fail("Invalid review.")
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("Please sign in.")

  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", input.reviewId)
    .eq("product_id", input.productId)

  if (error) return fail("Could not delete review.")

  refreshCatalogue()
  return { ok: true }
}

"use server"

import { updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { CACHE_TAGS } from "./queries"
import { categorySchema, productSchema, type ProductValues } from "./schema"

function toRow(p: ProductValues) {
  return {
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    compare_at_price: p.compareAtPrice ?? null,
    images: p.images,
    category_id: p.categoryId ?? null,
    stock: p.stock,
    fees: p.fees,
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

/** Storefront pages are cached; refresh them instantly after any catalogue change. */
function refreshCatalogue() {
  updateTag(CACHE_TAGS.products)
  updateTag(CACHE_TAGS.categories)
}

export async function saveProduct(
  id: string | null,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = productSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const supabase = await getServerSupabase()
  const row = toRow(parsed.data)

  const query = id
    ? supabase.from("products").update(row).eq("id", id).select("id").single<{ id: string }>()
    : supabase.from("products").insert(row).select("id").single<{ id: string }>()

  const { data, error } = await query
  if (error || !data) return fail(friendlyDbError(error?.message ?? "", error?.code))

  refreshCatalogue()
  return { ok: true, data: { id: data.id } }
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
  const paths = (product?.images ?? [])
    .map((url) => url.split("/storage/v1/object/public/product-images/")[1])
    .filter((p): p is string => Boolean(p))
  if (paths.length) await supabase.storage.from("product-images").remove(paths)

  refreshCatalogue()
  return { ok: true }
}

export async function toggleProductFlag(
  id: string,
  flag: "isActive" | "isFeatured",
  value: boolean
): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  if (!z.uuid().safeParse(id).success) return fail("Invalid product")

  const supabase = await getServerSupabase()
  const column = flag === "isActive" ? "is_active" : "is_featured"
  const { error } = await supabase
    .from("products")
    .update({ [column]: Boolean(value) })
    .eq("id", id)
  if (error) return fail("Could not update product")

  refreshCatalogue()
  return { ok: true }
}

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = categorySchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const supabase = await getServerSupabase()
  const { error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id)
    : await supabase.from("categories").insert(parsed.data)
  if (error) return fail(friendlyDbError(error.message, error.code))

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

  refreshCatalogue()
  return { ok: true }
}

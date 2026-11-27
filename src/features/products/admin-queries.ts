import "server-only"
import { z } from "zod"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  mapCategory,
  mapProduct,
  PRODUCT_SELECT,
  type Category,
  type CategoryRow,
  type Product,
  type ProductRow,
  type StockAlert,
} from "./types"

/** Admin reads are uncached and include inactive products (RLS allows admins). */
export async function listAllProducts(): Promise<Product[]> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const [, { data, error }] = await Promise.all([
    adminCheck,
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false })
      .returns<ProductRow[]>(),
  ])
  if (error) throw new Error(error.message)
  return data.map(mapProduct)
}

export async function getProductForEdit(idOrSlug: string): Promise<Product | null> {
  const adminCheck = requireAdmin()
  const key = decodeURIComponent(idOrSlug).trim()
  if (!key) {
    await adminCheck
    return null
  }
  const isUuid = z.uuid().safeParse(key).success
  const supabase = await getServerSupabase()
  const [, { data, error }] = await Promise.all([
    adminCheck,
    supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq(isUuid ? "id" : "slug", key)
      .maybeSingle<ProductRow>(),
  ])
  if (error) throw new Error(error.message)
  return data ? mapProduct(data) : null
}

export async function listAllCategories(): Promise<(Category & { productCount: number })[]> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const [, { data, error }] = await Promise.all([
    adminCheck,
    supabase
      .from("categories")
      .select("*, products(count)")
      .order("sort")
      .returns<(CategoryRow & { products: { count: number }[] })[]>(),
  ])
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...mapCategory(row), productCount: row.products[0]?.count ?? 0 }))
}

type StockAlertRow = {
  id: string
  product_id: string
  variant_id?: string | null
  variant_label?: string | null
  customer_name: string
  phone: string
  status: "waiting" | "notified"
  notified_at: string | null
  created_at: string
  product: {
    name: string
    slug: string
    stock: number
    images: string[] | null
    variants?: Array<{ id?: string; label?: string; stock?: number }> | null
  } | null
}

/** Back-in-stock customer alert list for Admin. Returns [] gracefully if migration 0068 is not yet applied. */
export async function listStockAlerts(): Promise<StockAlert[]> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const [, { data, error }] = await Promise.all([
    adminCheck,
    supabase
      .from("stock_alerts")
      .select("id, product_id, variant_id, variant_label, customer_name, phone, status, notified_at, created_at, product:products(name, slug, stock, images, variants)")
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<StockAlertRow[]>(),
  ])
  if (error || !data) return []
  return data
    .filter((r) => Boolean(r.product))
    .map((r) => {
      const variants = Array.isArray(r.product?.variants) ? r.product.variants : []
      const matchedVariant = r.variant_id ? variants.find((v) => v?.id === r.variant_id) : undefined
      const resolvedStock = r.variant_id
        ? Number(matchedVariant?.stock ?? 0)
        : Number(r.product?.stock ?? 0)
      const resolvedLabel = matchedVariant?.label?.trim() || r.variant_label?.trim() || null
      return {
        id: r.id,
        productId: r.product_id,
        variantId: r.variant_id ?? null,
        variantLabel: resolvedLabel,
        productName: r.product?.name ?? "Product",
        productSlug: r.product?.slug ?? "",
        productImage: r.product?.images?.[0] ?? null,
        productStock: resolvedStock,
        customerName: r.customer_name ?? "",
        phone: r.phone,
        status: r.status === "notified" ? "notified" : "waiting",
        notifiedAt: r.notified_at ?? null,
        createdAt: r.created_at,
      }
    })
}

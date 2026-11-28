"use server"

import { assertAdmin } from "@/features/auth/guards"
import { limited, RATE_LIMIT_MESSAGE } from "@/features/security/rate-limit"
import { getServerSupabase } from "@/lib/supabase/server"

export type AdminSearchOrder = {
  id: string
  orderCode: string
  customerName: string
  total: number
  status: string
  paymentStatus: string
}

export type AdminSearchProduct = {
  id: string
  name: string
  slug: string
  price: number
  stock: number
  isActive: boolean
}

export type AdminSearchCategory = {
  id: string
  name: string
  slug: string
}

export type AdminSearchPromo = {
  id: string
  code: string
  discountType: string
  discountValue: number
  isActive: boolean
}

export type AdminGlobalSearchResults = {
  orders: AdminSearchOrder[]
  products: AdminSearchProduct[]
  categories: AdminSearchCategory[]
  promos: AdminSearchPromo[]
}

export type AdminGlobalSearchResponse =
  | { ok: true; data: AdminGlobalSearchResults }
  | { ok: false; error: string; locked?: boolean }

const EMPTY_RESULTS: AdminGlobalSearchResults = {
  orders: [],
  products: [],
  categories: [],
  promos: [],
}

function sanitizePostgrestPattern(input: string): string {
  // Strip characters that break PostgREST `.or(...)` logic-tree syntax or act as wildcards (`*`, `%`, `_`)
  return input.replace(/[%_*,()"'\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 64)
}

/**
 * Live admin-only global search across Orders, Products, Categories, and Promo Codes.
 * Runs in parallel with tight limits for instant command-palette feedback.
 */
export async function searchAdminGlobal(rawQuery: string): Promise<AdminGlobalSearchResponse> {
  const auth = await assertAdmin()
  if (!auth.ok) {
    return { ok: false, error: auth.error, locked: /pin|locked/i.test(auth.error) }
  }

  if (typeof rawQuery !== "string") return { ok: true, data: EMPTY_RESULTS }

  const q = sanitizePostgrestPattern(rawQuery)
  if (q.length < 2) return { ok: true, data: EMPTY_RESULTS }

  if (await limited("track-order", `admin-search:${auth.user.id}`)) {
    return { ok: false, error: RATE_LIMIT_MESSAGE }
  }

  const supabase = await getServerSupabase()
  const pattern = `%${q}%`

  const [ordersRes, productsRes, categoriesRes, promosRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_code, customer_name, total, status, payment_status")
      .or(`order_code.ilike.${pattern},customer_name.ilike.${pattern},phone.ilike.${pattern},payment_reference.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("id, name, slug, price, stock, is_active")
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("categories")
      .select("id, name, slug")
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(4),
    supabase
      .from("promo_codes")
      .select("id, code, discount_type, discount_value, is_active")
      .or(`code.ilike.${pattern},description.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(4),
  ])

  if (ordersRes.error && productsRes.error && categoriesRes.error && promosRes.error) {
    return { ok: false, error: "Couldn't search live orders & products." }
  }

  return {
    ok: true,
    data: {
      orders: (ordersRes.data ?? []).map((o) => ({
        id: String(o.id),
        orderCode: String(o.order_code),
        customerName: String(o.customer_name),
        total: Number(o.total ?? 0),
        status: String(o.status ?? ""),
        paymentStatus: String(o.payment_status ?? ""),
      })),
      products: (productsRes.data ?? []).map((p) => ({
        id: String(p.id),
        name: String(p.name),
        slug: String(p.slug),
        price: Number(p.price ?? 0),
        stock: Number(p.stock ?? 0),
        isActive: Boolean(p.is_active),
      })),
      categories: (categoriesRes.data ?? []).map((c) => ({
        id: String(c.id),
        name: String(c.name),
        slug: String(c.slug),
      })),
      promos: (promosRes.data ?? []).map((pc) => ({
        id: String(pc.id),
        code: String(pc.code),
        discountType: String(pc.discount_type ?? "percent"),
        discountValue: Number(pc.discount_value ?? 0),
        isActive: Boolean(pc.is_active),
      })),
    },
  }
}

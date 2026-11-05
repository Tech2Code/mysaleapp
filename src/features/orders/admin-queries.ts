import "server-only"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  isOrderStatus,
  mapOrder,
  mapOrderWithHistory,
  ORDER_STATUSES,
  type Order,
  type OrderRow,
  type OrderStatus,
  type OrderWithHistory,
} from "./types"

export const ADMIN_ORDERS_PAGE_SIZE = 20

export type OrderFilters = { status?: string; q?: string; page?: string }

export async function listOrders(filters: OrderFilters): Promise<{ orders: Order[]; total: number; page: number }> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1)
  const from = (page - 1) * ADMIN_ORDERS_PAGE_SIZE

  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_ORDERS_PAGE_SIZE - 1)

  if (isOrderStatus(filters.status)) query = query.eq("status", filters.status)

  // Search by order code, phone or customer name. Strip characters that have
  // meaning in PostgREST filter syntax so user input can't alter the filter.
  const q = (filters.q ?? "").replace(/[^a-zA-Z0-9\s-]/g, "").trim().slice(0, 40)
  if (q) {
    query = query.or(`order_code.ilike.%${q}%,phone.ilike.%${q}%,customer_name.ilike.%${q}%`)
  }

  const { data, error, count } = await query.returns<OrderRow[]>()
  if (error) throw new Error(error.message)
  return { orders: data.map(mapOrder), total: count ?? 0, page }
}

export async function getOrderById(id: string): Promise<OrderWithHistory | null> {
  await requireAdmin()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("orders")
    .select("*, history:order_status_history(status, changed_at)")
    .eq("id", id)
    .maybeSingle<OrderRow>()
  if (error) throw new Error(error.message)
  return data ? mapOrderWithHistory(data) : null
}

export type DashboardStats = {
  today: number
  pending: number
  revenue30d: number
  orders30d: number
  byStatus: Record<OrderStatus, number>
  recent: Order[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireAdmin()
  const supabase = await getServerSupabase()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // One query for the last 30 days (small shop → small result), one for recent.
  const [{ data: last30, error: e1 }, { data: recent, error: e2 }, { count: pending, error: e3 }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("status, subtotal, created_at")
        .gte("created_at", since30d.toISOString())
        .limit(5000)
        .returns<Pick<OrderRow, "status" | "subtotal" | "created_at">[]>(),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(6).returns<OrderRow[]>(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ])
  if (e1 || e2 || e3) throw new Error((e1 ?? e2 ?? e3)!.message)

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>
  let revenue30d = 0
  let today = 0
  for (const o of last30 ?? []) {
    byStatus[o.status] += 1
    if (o.status !== "cancelled") revenue30d += Number(o.subtotal)
    if (new Date(o.created_at) >= startOfToday) today += 1
  }

  return {
    today,
    pending: pending ?? 0,
    revenue30d,
    orders30d: last30?.length ?? 0,
    byStatus,
    recent: (recent ?? []).map(mapOrder),
  }
}

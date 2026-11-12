import "server-only"
import { requireUser } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { resolveOrderPeriod } from "./dashboard-range"
import { mapOrder, mapOrderWithHistory, type Order, type OrderRow, type OrderWithHistory } from "./types"

const WITH_HISTORY = "*, history:order_status_history(status, changed_at), returns:order_returns(id, items, reason, refunded, created_at), return_requests(id, items, reason, details, status, admin_note, created_at, decided_at, pickup_date, picked_up_at)"

export type CustomerOrderStatusCounts = {
  active: number
  delivered: number
  cancelled: number
}

/** Orders of the signed-in customer. RLS also limits rows to auth.uid(). */
export async function getMyOrders(filters?: { year?: string; month?: string; status?: string; today?: string }): Promise<Order[]> {
  const user = await requireUser("/account/orders")
  const supabase = await getServerSupabase()
  let query = supabase
    .from("orders")
    .select("*, returns:order_returns(refunded, created_at), return_requests(status, created_at, decided_at, admin_note, pickup_date, picked_up_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (filters?.status === "active") {
    query = query.in("status", ["pending", "confirmed", "packed", "shipped"])
  } else if (filters?.status === "delivered" || filters?.status === "cancelled") {
    query = query.eq("status", filters.status)
  }

  const period = resolveOrderPeriod({ year: filters?.year, month: filters?.month }, filters?.today)
  if (period.startIso && period.endIso) {
    query = query.gte("created_at", period.startIso).lt("created_at", period.endIso)
  }

  const { data, error } = await query.returns<OrderRow[]>()
  if (error) throw new Error(error.message)
  return data.map(mapOrder)
}

export async function getMyOrderStatusCounts(): Promise<CustomerOrderStatusCounts> {
  const user = await requireUser("/account/orders")
  const supabase = await getServerSupabase()
  const head = () => supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id)

  const [active, delivered, cancelled] = await Promise.all([
    head().in("status", ["pending", "confirmed", "packed", "shipped"]),
    head().eq("status", "delivered"),
    head().eq("status", "cancelled"),
  ])
  return {
    active: active.count ?? 0,
    delivered: delivered.count ?? 0,
    cancelled: cancelled.count ?? 0,
  }
}

export async function getMyOrder(code: string, nextPath = `/account/orders/${code}`): Promise<OrderWithHistory | null> {
  const user = await requireUser(nextPath)
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("orders")
    .select(WITH_HISTORY)
    .eq("user_id", user.id)
    .eq("order_code", code.toUpperCase())
    .maybeSingle<OrderRow>()
  if (error) throw new Error(error.message)
  return data ? mapOrderWithHistory(data) : null
}

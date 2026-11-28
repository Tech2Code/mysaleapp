import "server-only"
import { requireUser } from "@/features/auth/guards"
import { getActiveProducts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { getServerSupabase } from "@/lib/supabase/server"
import { resolveOrderPeriod } from "./dashboard-range"
import { mapOrder, mapOrderWithHistory, type Order, type OrderRow, type OrderWithHistory } from "./types"

const WITH_HISTORY_BASE = "*, history:order_status_history(status, changed_at), returns:order_returns(id, items, reason, refunded, resolution_type, created_at), return_requests(id, items, reason, details, status, admin_note, created_at, decided_at, pickup_date, picked_up_at, resolution_type, exchange_preference)"
const WITH_HISTORY = "*, history:order_status_history(status, changed_at), returns:order_returns(id, items, reason, refunded, resolution_type, created_at), return_requests(id, items, reason, details, status, admin_note, created_at, decided_at, pickup_date, picked_up_at, resolution_type, exchange_preference, exchange_mode, exchange_status, exchange_shipped_at, exchange_delivered_at, exchange_tracking, exchange_shipping)"
const LIST_SELECT_BASE = "*, returns:order_returns(refunded, resolution_type, created_at), return_requests(status, created_at, decided_at, admin_note, pickup_date, picked_up_at, resolution_type, exchange_preference)"
const LIST_SELECT = "*, returns:order_returns(refunded, resolution_type, created_at), return_requests(status, created_at, decided_at, admin_note, pickup_date, picked_up_at, resolution_type, exchange_preference, exchange_mode, exchange_status, exchange_shipped_at, exchange_delivered_at, exchange_tracking)"

const isMissingExchangeCol = (err: { message?: string } | null | undefined) =>
  Boolean(
    err?.message &&
      (err.message.includes("exchange_status") || err.message.includes("exchange_mode") || err.message.includes("exchange_shipping")) &&
      err.message.includes("does not exist")
  )

export type CustomerOrderStatusCounts = {
  active: number
  delivered: number
  cancelled: number
}

/** Orders of the signed-in customer for the selected period (status tabs filter client-side for 0ms switching). */
export async function getMyOrders(filters?: { year?: string; month?: string; status?: string; today?: string }): Promise<Order[]> {
  const user = await requireUser("/account/orders")
  const supabase = await getServerSupabase()
  const buildQuery = (selectStr: string) => {
    let query = supabase
      .from("orders")
      .select(selectStr)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)

    const period = resolveOrderPeriod({ year: filters?.year, month: filters?.month }, filters?.today)
    if (period.startIso && period.endIso) {
      query = query.gte("created_at", period.startIso).lt("created_at", period.endIso)
    }
    return query.returns<OrderRow[]>()
  }

  let { data, error } = await buildQuery(LIST_SELECT)
  if (isMissingExchangeCol(error)) {
    ({ data, error } = await buildQuery(LIST_SELECT_BASE))
  }
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapOrder)
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
  const fetchOrder = (selectStr: string) =>
    supabase
      .from("orders")
      .select(selectStr)
      .eq("user_id", user.id)
      .eq("order_code", code.toUpperCase())
      .maybeSingle<OrderRow>()

  const [initialRes, products, shop] = await Promise.all([
    fetchOrder(WITH_HISTORY),
    getActiveProducts(),
    getStoreSettings(),
  ])
  let { data, error } = initialRes
  if (isMissingExchangeCol(error)) {
    ({ data, error } = await fetchOrder(WITH_HISTORY_BASE))
  }
  if (error) throw new Error(error.message)
  if (!data) return null
  const order = mapOrderWithHistory(data)
  const byId = new Map(products.map((p) => [p.id, p]))
  return {
    ...order,
    items: order.items.map((item) => {
      const live = byId.get(item.productId)
      const resolvedAspects =
        item.reviewAspects && item.reviewAspects.length > 0
          ? item.reviewAspects
          : live?.reviewAspects && live.reviewAspects.length > 0
            ? live.reviewAspects
            : live?.category?.reviewAspects && live.category.reviewAspects.length > 0
              ? live.category.reviewAspects
              : undefined
      return {
        ...item,
        returnWindowDays:
          item.returnWindowDays ?? live?.returnWindowDays ?? shop.returnWindowDays,
        reviewAspects: resolvedAspects,
      }
    }),
  }
}

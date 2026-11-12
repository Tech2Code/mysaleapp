import "server-only"
import { cache } from "react"
import { z } from "zod"
import { requireAdmin } from "@/features/auth/guards"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { getServerSupabase } from "@/lib/supabase/server"
import { istDayKey, resolveOrderPeriod, type DashboardRange } from "./dashboard-range"
import { isOrderView, RETURN_VIEWS, type OrderView } from "./views"
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

/** Just enough of the return rows for a list row to show its return stage (see returnStage()). */
const RETURN_EMBED = "returns:order_returns(refunded, created_at), return_requests(status, created_at, decided_at, admin_note, pickup_date, picked_up_at)"

export type OrderFilters = { status?: string; payment?: string; view?: string; q?: string; page?: string; year?: string; month?: string; today?: string }
/** Payment filter values the admin orders list accepts (besides "all"). */
export const PAYMENT_FILTERS = ["submitted", "failed", "pending", "paid", "refund-due", "refunded"] as const
const isPaymentFilter = (v: unknown): v is (typeof PAYMENT_FILTERS)[number] => (PAYMENT_FILTERS as readonly unknown[]).includes(v)

type Supabase = Awaited<ReturnType<typeof getServerSupabase>>

/** Filter to the orders that have a return request in `status`. No such orders -> match nothing (an impossible id), not everything. */
async function ordersWithRequest(supabase: Supabase, status: "requested" | "approved"): Promise<<Q>(query: Q) => Q> {
  const { data, error } = await supabase
    .from("return_requests")
    .select("order_id")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(RETURN_VIEW_ID_LIMIT)
  if (error) throw new Error(error.message)
  const ids = [...new Set((data ?? []).map((r) => r.order_id as string))]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query) => (query as any).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
}

/** How many order ids a return view looks up (they go into one URL; the newest win). Actionable views are far smaller. */
export const RETURN_VIEW_ID_LIMIT = 100

/**
 * Orders with a recorded return. `refunded` picks returns whose refund was recorded (true) or not (false);
 * the "refund pending" view also needs the order's payment to still be 'paid' (not fully refunded yet).
 */
async function ordersWithReturns(supabase: Supabase, opts: { refunded: boolean; stillPaid: boolean }): Promise<<Q>(query: Q) => Q> {
  const { data, error } = await supabase
    .from("order_returns")
    .select("order_id")
    .eq("refunded", opts.refunded)
    .order("created_at", { ascending: false })
    .limit(RETURN_VIEW_ID_LIMIT)
  if (error) throw new Error(error.message)
  const ids = [...new Set((data ?? []).map((r) => r.order_id as string))]
  /* eslint-disable @typescript-eslint/no-explicit-any */
  return (query) => {
    const q = (query as any).in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    return opts.stillPaid ? q.eq("payment_status", "paid") : q
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/**
 * THE definition of every order view. Used by the dashboard tile counts and by listOrders(), so they
 * can never disagree. Works on any PostgREST filter builder (the exact builder types are too deep to spell out).
 */
async function orderViewFilter(supabase: Supabase, view: OrderView): Promise<<Q>(query: Q) => Q> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  // (returns a plain function, not the builder itself: awaiting a PostgREST builder would run the query)
  switch (view) {
    case "to-verify":
      return (query) => (query as any).eq("payment_status", "submitted").neq("status", "cancelled")
    case "awaiting-payment":
      // SQL twin of isAwaitingPayment() in types.ts (and expire_unpaid_orders() in the migrations)
      return (query) => (query as any).eq("status", "pending").in("payment_status", ["pending", "failed"])
    case "to-ship":
      return (query) => (query as any).in("status", ["confirmed", "packed"])
    case "return-requests":
      // the requests live in their own table: orders with a request waiting for a decision
      return ordersWithRequest(supabase, "requested")
    case "returns-to-receive":
      // approved, the goods have not come back yet (the request turns 'received' when the admin records the return)
      return ordersWithRequest(supabase, "approved")
    case "return-refund-pending":
      // goods came back, no refund recorded for that return, and the payment is not fully refunded yet
      return ordersWithReturns(supabase, { refunded: false, stillPaid: true })
    case "returns-refunded":
      return ordersWithReturns(supabase, { refunded: true, stillPaid: false })
    default: {
      const never: never = view
      return never
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

/** Tile count: how many orders are in a view (same filter as the list). */
async function countOrdersInView(supabase: Supabase, view: OrderView) {
  const filter = await orderViewFilter(supabase, view)
  return filter(supabase.from("orders").select("id", { count: "exact", head: true }))
}

/** Counts for the return chips of the orders list: the same filter as the lists (see orderViewFilter). */
export type ReturnViewCounts = Record<(typeof RETURN_VIEWS)[number], number>

export type OrderFilterCounts = {
  returns: ReturnViewCounts
  status: Record<OrderStatus, number>
  payment: {
    submitted: number
    failed: number
    paid: number
    "refund-due": number
    refunded: number
  }
}

export async function getReturnViewCounts(): Promise<ReturnViewCounts> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const [, counts] = await Promise.all([
    adminCheck,
    Promise.all(RETURN_VIEWS.map(async (v) => (await countOrdersInView(supabase, v)).count ?? 0)),
  ])
  return Object.fromEntries(RETURN_VIEWS.map((v, i) => [v, counts[i]])) as ReturnViewCounts
}

export async function getOrderFilterCounts(): Promise<OrderFilterCounts> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const head = () => supabase.from("orders").select("id", { count: "exact", head: true })

  const [, returnCounts, statusCounts, paymentCounts] = await Promise.all([
    adminCheck,
    Promise.all(RETURN_VIEWS.map(async (v) => (await countOrdersInView(supabase, v)).count ?? 0)),
    Promise.all(ORDER_STATUSES.map(async (s) => (await head().eq("status", s)).count ?? 0)),
    Promise.all([
      head().eq("payment_status", "submitted").neq("status", "cancelled").then((r) => r.count ?? 0),
      head().eq("payment_status", "failed").neq("status", "cancelled").then((r) => r.count ?? 0),
      head().eq("payment_status", "paid").then((r) => r.count ?? 0),
      head().eq("status", "cancelled").in("payment_status", ["paid", "submitted"]).then((r) => r.count ?? 0),
      head().eq("payment_status", "refunded").then((r) => r.count ?? 0),
    ]),
  ])

  return {
    returns: Object.fromEntries(RETURN_VIEWS.map((v, i) => [v, returnCounts[i]])) as ReturnViewCounts,
    status: Object.fromEntries(ORDER_STATUSES.map((s, i) => [s, statusCounts[i]])) as Record<OrderStatus, number>,
    payment: {
      submitted: paymentCounts[0],
      failed: paymentCounts[1],
      paid: paymentCounts[2],
      "refund-due": paymentCounts[3],
      refunded: paymentCounts[4],
    },
  }
}

export async function listOrders(filters: OrderFilters): Promise<{ orders: Order[]; total: number; page: number }> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1)
  const from = (page - 1) * ADMIN_ORDERS_PAGE_SIZE

  let query = supabase
    .from("orders")
    .select(`*, ${RETURN_EMBED}`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ADMIN_ORDERS_PAGE_SIZE - 1)

  if (isOrderView(filters.view)) {
    query = (await orderViewFilter(supabase, filters.view))(query)
  } else {
    if (isOrderStatus(filters.status)) query = query.eq("status", filters.status)
    if (isPaymentFilter(filters.payment)) {
      if (filters.payment === "refund-due") {
        query = query.eq("status", "cancelled").in("payment_status", ["paid", "submitted"])
      } else {
        query = query.eq("payment_status", filters.payment)
        // a cancelled order is not "waiting" for a rejected/pending payment
        if (filters.payment === "pending" || filters.payment === "failed") query = query.neq("status", "cancelled")
      }
    }
  }

  // Search by order code, phone or customer name. Strip characters that have
  // meaning in PostgREST filter syntax so user input can't alter the filter.
  const rawQuery = (filters.q ?? "").trim()
  const normalizedPhone = rawQuery ? normalizeIndianPhone(rawQuery) : null
  const q = (normalizedPhone ?? rawQuery.replace(/[^\p{L}\p{M}0-9\s-]/gu, "").trim()).slice(0, LIMITS.orderSearch.max)
  if (rawQuery && !q) {
    await adminCheck
    return { orders: [], total: 0, page }
  }
  if (q) {
    query = query.or(`order_code.ilike.%${q}%,phone.ilike.%${q}%,customer_name.ilike.%${q}%`)
  } else if (!isOrderView(filters.view) && (filters.year !== undefined || filters.month !== undefined)) {
    const period = resolveOrderPeriod({ year: filters.year, month: filters.month }, filters.today)
    if (period.startIso && period.endIso) {
      query = query.gte("created_at", period.startIso).lt("created_at", period.endIso)
    }
  }

  const [, { data, error, count }] = await Promise.all([adminCheck, query.returns<OrderRow[]>()])
  // PGRST103: ?page= is past the last page (e.g. a filter shrank the list) -> show the first page instead of crashing
  if (error?.code === "PGRST103" && page > 1) return listOrders({ ...filters, page: "1" })
  if (error) throw new Error(error.message)
  return { orders: data.map(mapOrder), total: count ?? 0, page }
}

export async function getOrderById(id: string): Promise<OrderWithHistory | null> {
  const adminCheck = requireAdmin()
  if (!z.uuid().safeParse(id).success) {
    await adminCheck
    return null
  }
  const supabase = await getServerSupabase()
  const [, { data, error }] = await Promise.all([
    adminCheck,
    supabase
      .from("orders")
      .select("*, history:order_status_history(status, changed_at), private_note:order_admin_notes(note), returns:order_returns(id, items, reason, refunded, refund_amount, created_at), return_requests(id, items, reason, details, status, admin_note, created_at, decided_at, pickup_date, picked_up_at)")
      .eq("id", id)
      .maybeSingle<OrderRow>(),
  ])
  if (error) throw new Error(error.message)
  return data ? mapOrderWithHistory(data) : null
}

/** One bar/point of the chart: a day, or a whole month for long ranges. */
export type DayPoint = { date: string; label: string; revenue: number; orders: number }

export type TopProduct = { productId: string; name: string; image: string | null; quantity: number; revenue: number }

export type LowStockProduct = { id: string; name: string; stock: number; image: string | null }

export type DashboardData = {
  greeting: string
  todayLabel: string
  /** The range being shown, e.g. "Last 30 days". */
  rangeLabel: string
  /** True when there is an earlier period to compare with (not for "All time"). */
  hasPrevious: boolean
  /** Chart points over the range, oldest first (India time). */
  days: DayPoint[]
  /** Totals for the range and for the equally long period before it. */
  revenue: { current: number; previous: number }
  orders: { current: number; previous: number }
  averageOrder: { current: number; previous: number }
  /** Orders in the range by status. */
  byStatus: Record<OrderStatus, number>
  attention: { toVerify: number; awaitingPayment: number; toFulfil: number; returnRequests: number; returnsToReceive: number; refundsToSend: number }
  topProducts: TopProduct[]
  lowStock: LowStockProduct[]
  recent: Order[]
}

const IST = "Asia/Kolkata"
const DAY_MS = 24 * 60 * 60 * 1000
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST })
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: IST })

type StatNumber = number | string
type DashboardStats = {
  buckets: { key: string; revenue: StatNumber; orders: StatNumber }[]
  current: { revenue: StatNumber; orders: StatNumber; paid: StatNumber }
  previous: { revenue: StatNumber; orders: StatNumber; paid: StatNumber }
  byStatus: Partial<Record<OrderStatus, StatNumber>>
  topProducts: { productId: string; name: string; image: string | null; quantity: StatNumber; revenue: StatNumber }[]
}

/** Everything the admin dashboard shows. The numbers come from one SQL function (migration 0018); only labels and zero-filling happen here. */
export async function getDashboard(range: DashboardRange): Promise<DashboardData> {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()

  const now = new Date()

  const [, toVerifyCount, [statsRes, recentRes, awaitingRes, fulfilRes, returnsRes, pickupsRes, refundsRes, lowStockRes]] = await Promise.all([
    adminCheck,
    getPaymentsToVerifyCount(),
    Promise.all([
      supabase.rpc("dashboard_stats", {
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_prev_start: range.previous?.start.toISOString() ?? null,
        p_prev_end: range.previous?.end.toISOString() ?? null,
        p_bucket: range.bucket,
      }),
      supabase.from("orders").select(`*, ${RETURN_EMBED}`).order("created_at", { ascending: false }).limit(6).returns<OrderRow[]>(),
      countOrdersInView(supabase, "awaiting-payment"),
      countOrdersInView(supabase, "to-ship"),
      countOrdersInView(supabase, "return-requests"),
      countOrdersInView(supabase, "returns-to-receive"),
      countOrdersInView(supabase, "return-refund-pending"),
      supabase
        .from("products")
        .select("id, name, stock, images")
        .eq("is_active", true)
        .lte("stock", 5)
        .order("stock", { ascending: true })
        .limit(6)
        .returns<{ id: string; name: string; stock: number; images: string[] | null }[]>(),
    ]),
  ])
  const failed = [statsRes, recentRes, awaitingRes, fulfilRes, returnsRes, pickupsRes, refundsRes, lowStockRes].find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)
  const stats = statsRes.data as DashboardStats

  // ---- chart points: one per day, or per month for long ranges (zero-filled; SQL only returns buckets that have orders) ----
  const bucketKey = (d: Date) => (range.bucket === "month" ? istDayKey(d).slice(0, 7) : istDayKey(d))
  const days: DayPoint[] = []
  const index = new Map<string, DayPoint>()
  for (let t = range.start.getTime(); t < range.end.getTime(); t += DAY_MS) {
    const d = new Date(t)
    const key = bucketKey(d)
    if (index.has(key)) continue
    const point: DayPoint = { date: key, label: range.bucket === "month" ? monthLabel(d) : dayLabel(d), revenue: 0, orders: 0 }
    days.push(point)
    index.set(key, point)
  }
  for (const b of stats.buckets) {
    const point = index.get(b.key)
    if (point) {
      point.revenue = Number(b.revenue)
      point.orders = Number(b.orders)
    }
  }

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, Number(stats.byStatus[s] ?? 0)])) as Record<OrderStatus, number>
  const totals = (p: DashboardStats["current"]) => ({ revenue: Number(p.revenue), orders: Number(p.orders), paid: Number(p.paid) })
  const cur = totals(stats.current)
  const prev = totals(stats.previous)

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: IST }).format(now))
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const lowStock = (lowStockRes.data ?? []).map((p) => ({ id: p.id, name: p.name, stock: p.stock, image: p.images?.[0] ?? null }))

  return {
    greeting,
    todayLabel: now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: IST }),
    rangeLabel: range.label,
    hasPrevious: range.previous !== null,
    days,
    revenue: { current: cur.revenue, previous: prev.revenue },
    orders: { current: cur.orders, previous: prev.orders },
    averageOrder: {
      current: cur.paid ? cur.revenue / cur.paid : 0,
      previous: prev.paid ? prev.revenue / prev.paid : 0,
    },
    byStatus,
    attention: {
      toVerify: toVerifyCount,
      awaitingPayment: awaitingRes.count ?? 0,
      toFulfil: fulfilRes.count ?? 0,
      returnRequests: returnsRes.count ?? 0,
      returnsToReceive: pickupsRes.count ?? 0,
      refundsToSend: refundsRes.count ?? 0,
    },
    topProducts: stats.topProducts.map((p) => ({
      productId: p.productId,
      name: p.name,
      image: p.image ?? null,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue),
    })),
    lowStock,
    recent: (recentRes.data ?? []).map(mapOrder),
  }
}

/** For the sidebar badge: payments waiting to be verified. */
export const getPaymentsToVerifyCount = cache(async (): Promise<number> => {
  const adminCheck = requireAdmin()
  const supabase = await getServerSupabase()
  const [, { count }] = await Promise.all([
    adminCheck,
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "submitted")
      .neq("status", "cancelled"),
  ])
  return count ?? 0
})

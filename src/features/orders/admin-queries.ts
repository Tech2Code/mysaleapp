import "server-only"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { istDayKey, type DashboardRange } from "./dashboard-range"
import { isOrderView, type OrderView } from "./views"
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

export type OrderFilters = { status?: string; payment?: string; view?: string; q?: string; page?: string }
// Works on any PostgREST filter builder (the exact builder types are too deep to spell out).
function applyOrderView<Q>(query: Q, view: OrderView): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any
  switch (view) {
    case "to-verify":
      return q.eq("payment_status", "submitted").neq("status", "cancelled")
    case "awaiting-payment":
      return q.eq("status", "pending").in("payment_status", ["pending", "failed"])
    case "to-ship":
      return q.in("status", ["confirmed", "packed"])
    default: {
      const never: never = view
      return never
    }
  }
}

/** Payment filter values used by the admin orders list. */
export const PAYMENT_FILTERS = ["all", "submitted", "pending", "paid"] as const

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

  if (isOrderView(filters.view)) {
    query = applyOrderView(query, filters.view)
  } else {
    if (isOrderStatus(filters.status)) query = query.eq("status", filters.status)
    if (filters.payment === "submitted" || filters.payment === "pending" || filters.payment === "paid") {
      query = query.eq("payment_status", filters.payment)
      // a cancelled order is not "waiting" for anything
      if (filters.payment !== "paid") query = query.neq("status", "cancelled")
    }
  }

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
    .select("*, history:order_status_history(status, changed_at), private_note:order_admin_notes(note)")
    .eq("id", id)
    .maybeSingle<OrderRow>()
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
  attention: { toVerify: number; awaitingPayment: number; toFulfil: number }
  topProducts: TopProduct[]
  lowStock: LowStockProduct[]
  recent: Order[]
}

const IST = "Asia/Kolkata"
const DAY_MS = 24 * 60 * 60 * 1000
const dayLabel = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST })
const monthLabel = (d: Date) => d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: IST })

const PAGE = 1000
/** Safety cap (50,000 rows). Past it we refuse to show numbers that would silently be wrong. */
const MAX_PAGES = 50

/** The API caps a response, so read page by page. A unique tiebreaker (id) keeps pages stable. */
async function readAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = []
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE) return rows
  }
  throw new Error("Too many orders in this period to total up. Pick a shorter date range.")
}

/** Light columns for every order in the range (no `items`, which is the heavy part). */
async function fetchOrdersBetween(from: Date, to: Date): Promise<DashboardOrderRow[]> {
  const supabase = await getServerSupabase()
  return readAllPages<DashboardOrderRow>((a, b) =>
    supabase
      .from("orders")
      .select("id, status, total, subtotal, payment_status, created_at")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b)
      .returns<DashboardOrderRow[]>()
  )
}

/** Line items are only needed for "top products", which counts paid, non-cancelled orders of the current range. */
async function fetchPaidItems(from: Date, to: Date): Promise<Map<string, OrderRow["items"]>> {
  const supabase = await getServerSupabase()
  const rows = await readAllPages<{ id: string; items: OrderRow["items"] }>((a, b) =>
    supabase
      .from("orders")
      .select("id, items")
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", from.toISOString())
      .lt("created_at", to.toISOString())
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b)
      .returns<{ id: string; items: OrderRow["items"] }[]>()
  )
  return new Map(rows.map((r) => [r.id, r.items]))
}

type DashboardOrderRow = Pick<OrderRow, "id" | "status" | "total" | "subtotal" | "payment_status" | "created_at">

/** Everything the admin dashboard shows, in one go. Small shop → aggregated here, no extra tables needed. */
export async function getDashboard(range: DashboardRange): Promise<DashboardData> {
  await requireAdmin()
  const supabase = await getServerSupabase()

  const now = new Date()

  const [orderRows, itemsByOrder, recentRes, verifyRes, awaitingRes, fulfilRes, lowStockRes] = await Promise.all([
    fetchOrdersBetween(range.previous?.start ?? range.start, range.end),
    fetchPaidItems(range.start, range.end),
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(6).returns<OrderRow[]>(),
    applyOrderView(supabase.from("orders").select("id", { count: "exact", head: true }), "to-verify"),
    applyOrderView(supabase.from("orders").select("id", { count: "exact", head: true }), "awaiting-payment"),
    applyOrderView(supabase.from("orders").select("id", { count: "exact", head: true }), "to-ship"),
    supabase
      .from("products")
      .select("id, name, stock, images")
      .eq("is_active", true)
      .lte("stock", 5)
      .order("stock", { ascending: true })
      .limit(6)
      .returns<{ id: string; name: string; stock: number; images: string[] | null }[]>(),
  ])
  const failed = [recentRes, verifyRes, awaitingRes, fulfilRes, lowStockRes].find((r) => r.error)
  if (failed?.error) throw new Error(failed.error.message)

  // "All time" starts at the first real order, so the chart isn't mostly empty
  let start = range.start
  if (range.key === "all" && orderRows.length) {
    start = new Date(Math.min(...orderRows.map((o) => new Date(o.created_at).getTime())))
  }

  // ---- chart points: one per day, or per month for long ranges ---------------
  const bucketKey = (d: Date) => (range.bucket === "month" ? istDayKey(d).slice(0, 7) : istDayKey(d))
  const days: DayPoint[] = []
  const index = new Map<string, DayPoint>()
  for (let t = start.getTime(); t < range.end.getTime(); t += DAY_MS) {
    const d = new Date(t)
    const key = bucketKey(d)
    if (index.has(key)) continue
    const point: DayPoint = { date: key, label: range.bucket === "month" ? monthLabel(d) : dayLabel(d), revenue: 0, orders: 0 }
    days.push(point)
    index.set(key, point)
  }
  const cutoffCurrent = start

  const cur = { revenue: 0, orders: 0, paid: 0 }
  const prev = { revenue: 0, orders: 0, paid: 0 }
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>
  const productTotals = new Map<string, TopProduct>()

  for (const o of orderRows) {
    const created = new Date(o.created_at)
    const isCurrent = created >= cutoffCurrent
    const bucket = isCurrent ? cur : prev
    const total = Number(o.total ?? o.subtotal)
    const counts = o.status !== "cancelled"
    const isPaid = counts && o.payment_status === "paid"

    if (counts) bucket.orders += 1
    if (isPaid) {
      bucket.revenue += total
      bucket.paid += 1
    }
    if (!isCurrent) continue

    byStatus[o.status] += 1
    const point = index.get(bucketKey(created))
    if (point) {
      if (counts) point.orders += 1
      if (isPaid) point.revenue += total
    }
    if (isPaid) {
      for (const item of itemsByOrder.get(o.id) ?? []) {
        const t = productTotals.get(item.productId) ?? {
          productId: item.productId,
          name: item.name,
          image: item.image ?? null,
          quantity: 0,
          revenue: 0,
        }
        t.quantity += item.quantity
        t.revenue += Number(item.price) * item.quantity
        productTotals.set(item.productId, t)
      }
    }
  }

  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: IST }).format(now))
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
      toVerify: verifyRes.count ?? 0,
      awaitingPayment: awaitingRes.count ?? 0,
      toFulfil: fulfilRes.count ?? 0,
    },
    topProducts: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock,
    recent: (recentRes.data ?? []).map(mapOrder),
  }
}

/** For the sidebar badge: payments waiting to be verified. */
export async function getPaymentsToVerifyCount(): Promise<number> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const { count } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("payment_status", "submitted")
    .neq("status", "cancelled")
  return count ?? 0
}

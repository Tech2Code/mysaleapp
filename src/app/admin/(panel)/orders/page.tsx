import type { Metadata } from "next"
import { connection } from "next/server"
import { OrdersView } from "@/components/admin/orders-view"
import { ADMIN_ORDERS_PAGE_SIZE, getOrderFilterCounts, listOrders } from "@/features/orders/admin-queries"
import { istDayKey, resolveOrderPeriod } from "@/features/orders/dashboard-range"
import { firstParam } from "@/lib/validation"

export const metadata: Metadata = { title: "Orders" }

const one = firstParam

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams
  await connection()
  const today = istDayKey(new Date())
  const period = resolveOrderPeriod({ year: one(sp.year), month: one(sp.month) }, today)
  const filters = {
    status: one(sp.status),
    payment: one(sp.payment),
    view: one(sp.view),
    q: one(sp.q),
    page: one(sp.page),
    year: period.year,
    month: period.month,
    today,
  }
  const [{ orders, total, page }, filterCounts] = await Promise.all([listOrders(filters), getOrderFilterCounts()])
  const pages = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE))

  return <OrdersView orders={orders} total={total} page={page} pages={pages} filters={filters} filterCounts={filterCounts} />
}

import type { Metadata } from "next"
import { connection } from "next/server"
import { MyOrdersView } from "@/components/account/account-views"
import { istDayKey, resolveOrderPeriod } from "@/features/orders/dashboard-range"
import { getMyOrders, getMyOrderStatusCounts } from "@/features/orders/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { firstParam } from "@/lib/validation"

export const metadata: Metadata = { title: "My orders", robots: { index: false, follow: false } }

export default async function MyOrdersPage({ searchParams }: PageProps<"/account/orders">) {
  const sp = await searchParams
  await connection()
  const today = istDayKey(new Date())
  const period = resolveOrderPeriod({ year: firstParam(sp.year), month: firstParam(sp.month) }, today)
  const filters = {
    year: period.year,
    month: period.month,
    status: firstParam(sp.status),
    today,
  }
  const [orders, shop, statusCounts] = await Promise.all([getMyOrders(filters), getStoreSettings(), getMyOrderStatusCounts()])
  return <MyOrdersView orders={orders} shop={shop} filters={filters} statusCounts={statusCounts} />
}

import type { Metadata } from "next"
import { OrdersView } from "@/components/admin/orders-view"
import { ADMIN_ORDERS_PAGE_SIZE, getReturnViewCounts, listOrders } from "@/features/orders/admin-queries"

import { firstParam } from "@/lib/validation"

export const metadata: Metadata = { title: "Orders" }

const one = firstParam

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const sp = await searchParams
  const filters = { status: one(sp.status), payment: one(sp.payment), view: one(sp.view), q: one(sp.q), page: one(sp.page) }
  const [{ orders, total, page }, returnCounts] = await Promise.all([listOrders(filters), getReturnViewCounts()])
  const pages = Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE))

  return <OrdersView orders={orders} total={total} page={page} pages={pages} filters={filters} returnCounts={returnCounts} />
}

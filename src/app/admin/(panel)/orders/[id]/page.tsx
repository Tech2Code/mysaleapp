import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { AdminOrderView } from "@/components/admin/order-view"
import { getOrderById } from "@/features/orders/admin-queries"
import { paymentDeadline } from "@/features/orders/deadline"
import { isAwaitingPayment } from "@/features/orders/types"
import { getStoreSettings } from "@/features/settings/queries"
import Loading from "./loading"

export const metadata: Metadata = { title: "Order details" }

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminOrderDetails params={params} />
    </Suspense>
  )
}

async function AdminOrderDetails({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  const { id } = await params
  const [order, shop] = await Promise.all([getOrderById(id), getStoreSettings()])
  if (!order) notFound()
  const autoCancelAt = isAwaitingPayment(order) ? paymentDeadline(order.createdAt, shop.unpaidOrderExpiryHours, order.updatedAt) : null

  return <AdminOrderView order={order} autoCancelAt={autoCancelAt} />
}

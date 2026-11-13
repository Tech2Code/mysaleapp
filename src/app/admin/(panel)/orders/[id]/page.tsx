import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { AdminOrderView } from "@/components/admin/order-view"
import { getOrderById } from "@/features/orders/admin-queries"
import { paymentDeadline } from "@/features/orders/deadline"
import { isAwaitingPayment } from "@/features/orders/types"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Order details" }

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  await connection()
  const { id } = await params
  const [order, shop] = await Promise.all([getOrderById(id), getStoreSettings()])
  if (!order) notFound()
  const autoCancelAt = isAwaitingPayment(order) ? paymentDeadline(order.createdAt, shop.unpaidOrderExpiryHours, order.updatedAt) : null

  return <AdminOrderView order={order} autoCancelAt={autoCancelAt} />
}

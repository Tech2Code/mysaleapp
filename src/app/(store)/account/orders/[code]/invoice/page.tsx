import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { InvoicePageView } from "@/components/account/account-views"
import { getMyOrder } from "@/features/orders/queries"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } }

export default async function MyInvoicePage({ params }: PageProps<"/account/orders/[code]/invoice">) {
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code), getStoreSettings()])
  if (!order) notFound()

  return <InvoicePageView order={order} shop={shop} backHref={`/account/orders/${order.orderCode}`} />
}

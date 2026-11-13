import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { InvoicePageView } from "@/components/account/account-views"
import { getMyOrder } from "@/features/orders/queries"
import { getStoreSettings } from "@/features/settings/queries"
import Loading from "./loading"

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } }

export default function MyInvoicePage({ params }: PageProps<"/account/orders/[code]/invoice">) {
  return (
    <Suspense fallback={<Loading />}>
      <MyInvoiceDetails params={params} />
    </Suspense>
  )
}

async function MyInvoiceDetails({ params }: Pick<PageProps<"/account/orders/[code]/invoice">, "params">) {
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code, `/account/orders/${code}/invoice`), getStoreSettings()])
  if (!order || order.status === "cancelled") notFound()

  return <InvoicePageView order={order} shop={shop} backHref={`/account/orders/${order.orderCode}`} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { InvoicePageView } from "@/components/account/account-views"
import { getOrderById } from "@/features/orders/admin-queries"
import { getStoreSettings } from "@/features/settings/queries"
import Loading from "./loading"

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } }

/** Printable bill for the admin (print or save as PDF, then send it to the customer). */
export default function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Loading />}>
      <AdminInvoiceDetails params={params} />
    </Suspense>
  )
}

async function AdminInvoiceDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [order, shop] = await Promise.all([getOrderById(id), getStoreSettings()])
  if (!order || order.status === "cancelled") notFound()

  return <InvoicePageView order={order} shop={shop} backHref={`/admin/orders/${order.id}`} />
}

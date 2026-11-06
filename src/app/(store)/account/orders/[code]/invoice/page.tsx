import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { InvoiceDocument } from "@/components/shared/invoice-document"
import { PrintButton } from "@/components/shared/print-button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyOrder } from "@/features/orders/queries"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } }

async function Invoice({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code), getStoreSettings()])
  if (!order) notFound()

  return (
    <div data-ui="page:/account/orders/[code]/invoice#Invoice" className="space-y-4">
      <div data-ui="page:/account/orders/[code]/invoice#Invoice/div-flex" className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link data-ui="page:/account/orders/[code]/invoice#Invoice/Link-back-to-order" href={`/account/orders/${order.orderCode}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to order
        </Link>
        {order.status !== "cancelled" && <PrintButton />}
      </div>
      {order.status === "cancelled" ? (
        <p data-ui="page:/account/orders/[code]/invoice#Invoice/p" className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">This order was cancelled, so there is no invoice for it.</p>
      ) : (
        <InvoiceDocument order={order} shop={shop} />
      )}
    </div>
  )
}

export default function MyInvoicePage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<Skeleton data-ui="page:/account/orders/[code]/invoice/Skeleton" className="mx-auto h-128 max-w-3xl rounded-2xl" />}>
      <Invoice params={params} />
    </Suspense>
  )
}

import { ArrowLeftIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { InvoiceDocument } from "@/components/shared/invoice-document"
import { PrintButton } from "@/components/shared/print-button"
import { getOrderById } from "@/features/orders/admin-queries"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } }

/** Printable bill for the admin (print or save as PDF, then send it to the customer). */
export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [order, shop] = await Promise.all([getOrderById(id), getStoreSettings()])
  if (!order) notFound()

  return (
    <div data-ui="page:/admin/orders/[id]/invoice" className="space-y-4">
      <div data-ui="page:/admin/orders/[id]/invoice/div-flex" className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link data-ui="page:/admin/orders/[id]/invoice/Link-back-to-order" href={`/admin/orders/${order.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to order
        </Link>
        {order.status !== "cancelled" && <PrintButton />}
      </div>
      {order.status === "cancelled" ? (
        <p data-ui="page:/admin/orders/[id]/invoice/p" className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">This order was cancelled, so there is no invoice for it.</p>
      ) : (
        <InvoiceDocument order={order} shop={shop} />
      )}
    </div>
  )
}

import { ArrowLeftIcon, PhoneIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { AdminCancelOrder, AdminNoteForm, OrderStatusControl } from "@/components/admin/order-controls"
import { PaymentControl } from "@/components/admin/payment-control"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { CopyButton } from "@/components/shared/copy-button"
import { OrderSummary } from "@/components/shared/order-summary"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { getOrderById } from "@/features/orders/admin-queries"
import { whatsappLink } from "@/features/orders/whatsapp"
import { formatDateTime } from "@/lib/format"

export const metadata: Metadata = { title: "Order details" }

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section data-ui="page:/admin/orders/[id]#Card" className="rounded-2xl border bg-card p-5 sm:p-6">
      {title && <h2 className="mb-4 font-sans text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  )
}

/**
 * Admin order page. Wide column = the work to do (items, payment, fulfilment);
 * narrow column = who the order is for (customer, address, notes). Keeping the
 * narrow column short means neither side is left with a big empty gap.
 */
export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params
  const order = await getOrderById(id)
  if (!order) notFound()

  // Changes whenever the order changes (e.g. payment verified → status becomes "confirmed"),
  // so the forms below always start from the saved values instead of stale ones.
  const version = `${order.status}-${order.paymentStatus}-${order.updatedAt}`

  return (
    <>
      <Link href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>

      <header className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-mono text-2xl font-semibold sm:text-3xl">{order.orderCode}</h1>
        <CopyButton value={order.orderCode} label="Order ID" />
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} className="text-sm" pulse />
          <PaymentBadge status={order.paymentStatus} orderStatus={order.status} method={order.paymentMethod} className="text-sm" />
        </div>
        <span className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</span>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0 space-y-6">
          {order.cancellation && (
            <CancellationNotice cancellation={order.cancellation} paymentStatus={order.paymentStatus} audience="admin" />
          )}
          <OrderSummary order={order} openLinksInNewTab />

          <Card>
            <PaymentControl key={`pay-${version}`} order={order} />
          </Card>

          <Card title="Fulfilment">
            <div className="grid gap-8 md:grid-cols-2">
              <OrderStatusControl
                key={`status-${version}`}
                orderId={order.id}
                orderCode={order.orderCode}
                customerName={order.customerName}
                phone={order.phone}
                status={order.status}
                paymentStatus={order.paymentStatus}
                shipping={order.shipping}
              />
              <div>
                <h3 className="mb-4 text-sm font-medium">Progress</h3>
                <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} />
              </div>
            </div>
            <div className="mt-6 border-t pt-5 sm:max-w-xs">
              <AdminCancelOrder
                orderId={order.id}
                orderCode={order.orderCode}
                status={order.status}
                paidOrSent={order.paymentStatus === "paid" || order.paymentStatus === "submitted"}
              />
            </div>
          </Card>
        </div>

        <aside className="space-y-6 xl:sticky-admin">
          <Card title="Customer">
            <p className="font-medium">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">+91 {order.phone}</p>
            <p className="mt-1 text-xs text-muted-foreground">{order.userId ? "Signed-in customer" : "Guest checkout"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={whatsappLink(`91${order.phone}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-whatsapp-solid px-4 text-sm font-semibold text-white"
              >
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
              <a href={`tel:+91${order.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold">
                <PhoneIcon className="size-4" /> Call
              </a>
            </div>
          </Card>

          <Card title="Ship to">
            <p className="text-sm">{order.address}</p>
            <p className="text-sm">
              {order.city} - {order.pincode}
            </p>
            {order.deliveryUpdatedAt && (
              <p className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                Customer updated this on {formatDateTime(order.deliveryUpdatedAt)}
              </p>
            )}
            {order.note && (
              <p className="mt-3 rounded-xl bg-secondary/70 p-3 text-sm">
                <span className="font-semibold">Customer note:</span> {order.note}
              </p>
            )}
          </Card>

          <Card>
            <AdminNoteForm orderId={order.id} note={order.adminNote} />
          </Card>
        </aside>
      </div>
    </>
  )
}

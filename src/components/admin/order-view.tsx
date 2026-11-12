import { RefundSummary } from "@/components/shared/refund-summary"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { ArrowLeftIcon, PhoneIcon, ReceiptTextIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { CourierEditButton } from "@/components/admin/courier-dialog"
import { ReturnStatusControl } from "@/components/admin/return-status-control"
import { AdminReturnRequests } from "@/components/admin/return-requests"
import { AdminCancelOrder, AdminNoteForm, OrderStatusControl } from "@/components/admin/order-controls"
import { PaymentControl } from "@/components/admin/payment-control"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { stageInputOf } from "@/features/orders/returns"
import { CopyButton } from "@/components/shared/copy-button"
import { OrderSummary } from "@/components/shared/order-summary"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { whatsappLink } from "@/features/orders/whatsapp"
import { formatDeadline } from "@/features/orders/deadline"
import { CANCELLABLE_BY_ADMIN } from "@/features/orders/transitions"
import { canVerifyPayment, type OrderWithHistory } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section data-ui="admin/Card" className="rounded-2xl border bg-card p-5 sm:p-6">
      {title && <h2 data-ui="admin/Card/h2" className="mb-4 font-sans text-lg font-semibold">{title}</h2>}
      {children}
    </section>
  )
}

/**
 * Admin order page (the page passes the real order; loading.tsx passes a placeholder inside <Skeletonize>). Wide column = the work to do (items, payment, fulfilment);
 * narrow column = who the order is for (customer, address, notes). Keeping the
 * narrow column short means neither side is left with a big empty gap.
 */
export function AdminOrderView({ order, autoCancelAt }: { order: OrderWithHistory; autoCancelAt: Date | null }) {
  // Changes whenever the order changes (e.g. payment verified → status becomes "confirmed"),
  // so the forms below always start from the saved values instead of stale ones.
  // An unpaid order (or a cancelled order with a submitted/paid payment to resolve) puts the Payment card first.
  const paymentFirst = canVerifyPayment(order) || (order.status === "cancelled" && order.paymentStatus === "paid")
  const paymentSection = (
    <div data-ui="admin/AdminOrderView/div" className="rounded-xl border p-4">
      <PaymentControl key={`pay-${order.paymentStatus}-${order.updatedAt}`} order={order} />
    </div>
  )
  const version = `${order.status}-${order.paymentStatus}-${order.updatedAt}`

  return (
    <>
      <Link data-ui="admin/AdminOrderView/Link-all-orders" href="/admin/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>

      <header data-ui="admin/AdminOrderView/header-flex" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 data-ui="admin/AdminOrderView/h1" className="font-mono text-2xl font-semibold sm:text-3xl">{order.orderCode}</h1>
        <CopyButton value={order.orderCode} label="Order ID" />
        <div data-ui="admin/AdminOrderView/div-flex" className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} returnStage={order.returnStage} paymentStatus={order.paymentStatus} audience="admin" className="text-sm" pulse alwaysShow />
        </div>
        <span data-ui="admin/AdminOrderView/span" className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</span>
        {order.status !== "cancelled" && (
          <Link data-ui="admin/AdminOrderView/Link-invoice" href={`/admin/orders/${order.id}/invoice`} className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted">
            <ReceiptTextIcon className="size-4" /> Invoice
          </Link>
        )}
        {autoCancelAt && (
          <span data-ui="admin/AdminOrderView/span-2" className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            Auto-cancels {formatDeadline(autoCancelAt)} if unpaid
          </span>
        )}
      </header>

      <div data-ui="admin/AdminOrderView/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div data-ui="admin/AdminOrderView/div-2" className="min-w-0 space-y-6">
          {order.cancellation && (
            <CancellationNotice cancellation={order.cancellation} paymentStatus={order.paymentStatus} audience="admin" />
          )}
          {/* ONE work card. Left: payment, status, cancel. STICKY: it follows the reader while the long timeline scrolls on the right
              (a sticky box only moves while the right side is taller; capped to the screen so it scrolls inside itself if it is taller). */}
          <Card title="Fulfilment">
            <div data-ui="admin/AdminOrderView/div-grid-2" className="grid gap-8 md:grid-cols-2 md:items-start">
              <div data-ui="admin/AdminOrderView/div-3" className="min-w-0 space-y-6 md:sticky-admin">
                {paymentFirst && paymentSection}
                <OrderStatusControl
                  key={`status-${version}`}
                  orderId={order.id}
                  orderCode={order.orderCode}
                  customerName={order.customerName}
                  phone={order.phone}
                  status={order.status}
                  paymentStatus={order.paymentStatus}
                  shipping={order.shipping}
                  returnStage={order.returnStage}
                  returnControl={
                    <ReturnStatusControl
                      orderId={order.id}
                      orderCode={order.orderCode}
                      customerName={order.customerName}
                      phone={order.phone}
                      status={order.status}
                      paymentStatus={order.paymentStatus}
                      refundedAmount={order.refundedAmount}
                      items={order.items}
                      requests={order.returnRequests}
                      returns={order.returns}
                      stage={order.returnStage}
                    />
                  }
                />
                {!paymentFirst && paymentSection}
                {CANCELLABLE_BY_ADMIN.includes(order.status) && (
                <div data-ui="admin/AdminOrderView/div-4" className="space-y-3 border-t pt-5">
                  <AdminCancelOrder
                    orderId={order.id}
                    orderCode={order.orderCode}
                    status={order.status}
                    paidOrSent={order.paymentStatus === "paid" || order.paymentStatus === "submitted"}
                  />
                </div>
                )}
              </div>
              <div data-ui="admin/AdminOrderView/div-5" className="min-w-0">
                <div data-ui="admin/AdminOrderView/div-6">
                  <h3 data-ui="admin/AdminOrderView/h3-progress" className="mb-4 text-sm font-medium">Progress</h3>
                  <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} shippingAction={order.status === "shipped" && order.shipping ? <CourierEditButton orderId={order.id} shipping={order.shipping} /> : undefined} returnInput={stageInputOf(order)} audience="admin" />
                </div>
              </div>
            </div>
          </Card>
          <AdminReturnRequests
            requests={order.returnRequests}
            returns={order.returns}
            returnStage={order.returnStage}
            admin={{ items: order.items, paymentStatus: order.paymentStatus, refundedAmount: order.refundedAmount }}
          />
          <RefundSummary order={order} />
          <OrderSummary order={order} openLinksInNewTab audience="admin" />
        </div>

        <aside data-ui="admin/AdminOrderView/aside" className="space-y-6 xl:sticky-admin">
          <Card title="Customer">
            <p data-ui="admin/AdminOrderView/p" className="font-medium">{order.customerName}</p>
            <p data-ui="admin/AdminOrderView/p-2" className="text-sm text-muted-foreground">+91 {order.phone}</p>
            <p data-ui="admin/AdminOrderView/p-3" className="mt-1 text-xs text-muted-foreground">{order.userId ? "Signed-in customer" : "Guest checkout"}</p>
            <div data-ui="admin/AdminOrderView/div-flex-2" className="mt-4 flex flex-wrap gap-2">
              <a data-ui="admin/AdminOrderView/a-whatsapp"
                href={whatsappLink(`91${order.phone}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-whatsapp-solid px-4 text-sm font-semibold text-white"
              >
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
              <a data-ui="admin/AdminOrderView/a-call" href={`tel:+91${order.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold">
                <PhoneIcon className="size-4" /> Call
              </a>
            </div>
          </Card>

          <Card title="Ship to">
            <p data-ui="admin/AdminOrderView/p-4" className="text-sm">{order.address}</p>
            <p data-ui="admin/AdminOrderView/p-5" className="text-sm">
              {order.city} - {order.pincode}
            </p>
            {order.deliveryUpdatedAt && (
              <p data-ui="admin/AdminOrderView/p-6" className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                Customer updated this on {formatDateTime(order.deliveryUpdatedAt)}
              </p>
            )}
            {order.note && (
              <p data-ui="admin/AdminOrderView/p-7" className="mt-3 rounded-xl bg-secondary/70 p-3 text-sm">
                <span data-ui="admin/AdminOrderView/span-3" className="font-semibold">Customer note:</span> {order.note}
              </p>
            )}
          </Card>

          <Card>
            <AdminNoteForm key={`note-${order.adminNote ?? ""}`} orderId={order.id} note={order.adminNote} />
          </Card>
        </aside>
      </div>
    </>
  )
}

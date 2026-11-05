import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { ReturnsList } from "@/components/shared/returns-list"
import { CopyButton } from "@/components/shared/copy-button"
import { OrderSummary } from "@/components/shared/order-summary"
import { CancelOrder } from "@/components/store/cancel-order"
import { DeliveryEditor } from "@/components/store/delivery-editor"
import { PaymentPanel } from "@/components/store/payment-panel"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { StatusBadge } from "@/components/shared/status-badge"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyOrder } from "@/features/orders/queries"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { getStoreSettings } from "@/features/settings/queries"
import { formatDate } from "@/lib/format"

async function OrderDetail({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code), getStoreSettings()])
  if (!order) notFound()

  return (
    <div data-ui="page:/account/orders/[code]#OrderDetail" className="space-y-6">
      <div data-ui="page:/account/orders/[code]#OrderDetail/div-flex" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-5">
        <div data-ui="page:/account/orders/[code]#OrderDetail/div">
          <div data-ui="page:/account/orders/[code]#OrderDetail/div-flex-2" className="flex flex-wrap items-center gap-3">
            <h2 data-ui="page:/account/orders/[code]#OrderDetail/h2" className="font-mono text-2xl font-semibold">{order.orderCode}</h2>
            <CopyButton value={order.orderCode} label="Order ID" />
          </div>
          <p data-ui="page:/account/orders/[code]#OrderDetail/p" className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.status} className="text-sm" pulse />
      </div>

      {/* Progress gets the wide column; what you ordered + what you paid sits beside it. */}
      <div data-ui="page:/account/orders/[code]#OrderDetail/div-grid" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div data-ui="page:/account/orders/[code]#OrderDetail/div-2" className="space-y-6">
        <ReturnsList returns={order.returns} audience="customer" />
        {order.cancellation && (
          <CancellationNotice cancellation={order.cancellation} paymentStatus={order.paymentStatus} audience="customer" />
        )}
        <PaymentPanel
          orderCode={order.orderCode}
          phoneLast4={order.phone.slice(-4)}
          total={order.total}
          orderStatus={order.status}
          payment={order}
        />
        <section data-ui="page:/account/orders/[code]#OrderDetail/section" aria-labelledby="progress-title" className="rounded-3xl border bg-card p-6 sm:p-8">
          <h3 data-ui="page:/account/orders/[code]#OrderDetail/h3-order-progress" id="progress-title" className="mb-6 font-sans text-lg font-semibold">
            Order progress
          </h3>
          <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} />
          {/* Help + cancel live together, under the progress they relate to */}
          <div data-ui="page:/account/orders/[code]#OrderDetail/div-flex-3" className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:flex-wrap sm:items-center">
            <a data-ui="page:/account/orders/[code]#OrderDetail/a-ask-about-this-order"
              href={shopWhatsappLink(shop, `Hi! I have a question about my order ${order.orderCode}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp-solid px-6 text-sm font-semibold text-white sm:w-auto"
            >
              <WhatsAppIcon className="size-4" /> Ask about this order
            </a>
            <CancelOrder
              orderCode={order.orderCode}
              status={order.status}
              paymentStatus={order.paymentStatus}
              whatsappUrl={shopWhatsappLink(shop, `Hi! I want to cancel my order ${order.orderCode}.`)}
            />
          </div>
        </section>
        </div>

        <div data-ui="page:/account/orders/[code]#OrderDetail/div-3" className="space-y-6 xl:sticky-store xl:self-start">
          <OrderSummary order={order} />

          <DeliveryEditor
            orderCode={order.orderCode}
            delivery={{
              name: order.customerName,
              phone: order.phone,
              address: order.address,
              city: order.city,
              pincode: order.pincode,
              note: order.note,
            }}
            editable={order.status === "pending"}
          />
        </div>
      </div>
    </div>
  )
}

export default function MyOrderPage({ params }: PageProps<"/account/orders/[code]">) {
  return (
    <section data-ui="page:/account/orders/[code]" className="space-y-6">
      <Link data-ui="page:/account/orders/[code]/Link-all-orders" href="/account/orders" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>
      <Suspense fallback={<Skeleton data-ui="page:/account/orders/[code]/Skeleton" className="h-96 rounded-3xl" />}>
        <OrderDetail params={params} />
      </Suspense>
    </section>
  )
}

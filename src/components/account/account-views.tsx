import { ArrowLeftIcon, ChevronRightIcon, PackageIcon, ReceiptTextIcon } from "lucide-react"
import Link from "next/link"
import { AddressBook } from "@/components/account/address-book"
import { ProfileForm } from "@/components/account/profile-form"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { CopyButton } from "@/components/shared/copy-button"
import { InvoiceDocument } from "@/components/shared/invoice-document"
import { OrderSummary } from "@/components/shared/order-summary"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { PrintButton } from "@/components/shared/print-button"
import { ReturnsList } from "@/components/shared/returns-list"
import { ReturnStageBadge } from "@/components/shared/return-stage-badge"
import { ReturnTimeline } from "@/components/shared/return-timeline"
import { StatusBadge } from "@/components/shared/status-badge"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { CancelOrder } from "@/components/store/cancel-order"
import { DeliveryEditor } from "@/components/store/delivery-editor"
import { PaymentPanel } from "@/components/store/payment-panel"
import { RequestReturn, ReturnRequestsPanel } from "@/components/store/request-return"
import { buttonVariants } from "@/components/ui/button"
import type { Profile } from "@/features/account/schema"
import type { Address } from "@/features/addresses/types"
import { describeHours, formatDeadline, paymentDeadline } from "@/features/orders/deadline"
import { canRequestAgain, customerStatusLine, stageInputOf } from "@/features/orders/returns"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { isAwaitingPayment, STATUS_META, type Order, type OrderWithHistory } from "@/features/orders/types"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * The signed-in customer's pages. Each is rendered by its page with real data and by its
 * loading.tsx (inside <Skeletonize>) with placeholder data, so the two always have the same layout.
 */

// ---------------------------------------------------------------- my orders

export function MyOrdersView({ orders, shop }: { orders: Order[]; shop: StoreSettings }) {
  return (
    <section data-ui="account/MyOrdersView">
      <h2 data-ui="account/MyOrdersView/h2-my-orders" className="mb-6 text-3xl font-semibold">My orders</h2>
      {orders.length === 0 ? (
        <div data-ui="account/MyOrdersView/div-flex" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
          <PackageIcon className="size-10 text-muted-foreground" />
          <p data-ui="account/MyOrdersView/p" className="font-heading text-2xl">No orders yet</p>
          <p data-ui="account/MyOrdersView/p-2" className="max-w-sm text-sm text-muted-foreground">
            Orders you place while signed in appear here. Guest orders can be tracked with their order code.
          </p>
          <div data-ui="account/MyOrdersView/div-flex-2" className="flex gap-3">
            <Link data-ui="account/MyOrdersView/Link-start-shopping" href="/products" className={cn(buttonVariants(), "rounded-full px-5")}>
              Start shopping
            </Link>
            <Link data-ui="account/MyOrdersView/Link-track-a-guest-order" href="/track" className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
              Track a guest order
            </Link>
          </div>
        </div>
      ) : (
        <ul data-ui="account/MyOrdersView/ul" className="space-y-3">
          {orders.map((o) => (
            <li data-ui="account/MyOrdersView/li" key={o.id}>
              <Link data-ui="account/MyOrdersView/Link-flex"
                href={`/account/orders/${o.orderCode}`}
                className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-5"
              >
                <div data-ui="account/MyOrdersView/div" className="min-w-0 flex-1 space-y-1">
                  <div data-ui="account/MyOrdersView/div-flex-3" className="flex flex-wrap items-center gap-2">
                    <span data-ui="account/MyOrdersView/span" className="font-mono font-semibold">{o.orderCode}</span>
                    <StatusBadge status={o.status} />
                    <ReturnStageBadge stage={o.returnStage} audience="customer" />
                    {isAwaitingPayment(o) && (
                      <span data-ui="account/MyOrdersView/span-2" className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Pay now</span>
                    )}
                    {o.status === "pending" && o.paymentStatus === "submitted" && (
                      <span data-ui="account/MyOrdersView/span-3" className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-200">
                        Verifying payment
                      </span>
                    )}
                  </div>
                  <p data-ui="account/MyOrdersView/p-3" className="truncate text-sm text-muted-foreground">
                    {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                  </p>
                  {o.returnStage?.badge && o.returnStage.active && (
                    <p data-ui="account/MyOrdersView/p-4" className="text-xs font-medium text-foreground">{o.returnStage.customerDetail}</p>
                  )}
                  <p data-ui="account/MyOrdersView/p-5" className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</p>
                  {isAwaitingPayment(o) && shop.unpaidOrderExpiryHours > 0 && (
                    <p data-ui="account/MyOrdersView/p-6" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Pay by {formatDeadline(paymentDeadline(o.createdAt, shop.unpaidOrderExpiryHours)!)} · unpaid orders are cancelled automatically after {describeHours(shop.unpaidOrderExpiryHours)}
                    </p>
                  )}
                </div>
                <span data-ui="account/MyOrdersView/span-4" className="font-semibold">{formatPrice(o.total)}</span>
                <ChevronRightIcon className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- one order

export function MyOrderView({
  order,
  shop,
  win,
}: {
  order: OrderWithHistory
  shop: StoreSettings
  /** The return window, computed by the page (it reads the clock). */
  win: { open: boolean; until: Date | null }
}) {
  return (
    <section data-ui="account/MyOrderView" className="space-y-6">
      <Link data-ui="account/MyOrderView/Link-all-orders" href="/account/orders" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All orders
      </Link>
      <div data-ui="account/MyOrderView/div" className="space-y-6">
        <div data-ui="account/MyOrderView/div-flex" className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border bg-card p-5">
          <div data-ui="account/MyOrderView/div-2">
            <div data-ui="account/MyOrderView/div-flex-2" className="flex flex-wrap items-center gap-3">
              <h2 data-ui="account/MyOrderView/h2" className="font-mono text-2xl font-semibold">{order.orderCode}</h2>
              <CopyButton value={order.orderCode} label="Order ID" />
            </div>
            <p data-ui="account/MyOrderView/p" className="text-sm text-muted-foreground">Placed on {formatDate(order.createdAt)}</p>
          </div>
          <div data-ui="account/MyOrderView/div-flex-3" className="flex flex-wrap items-center gap-3">
            {order.status !== "cancelled" && (
              <Link data-ui="account/MyOrderView/Link-invoice" href={`/account/orders/${order.orderCode}/invoice`} className="inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm font-semibold hover:bg-muted">
                <ReceiptTextIcon className="size-4" /> Invoice
              </Link>
            )}
            <StatusBadge status={order.status} className="text-sm" pulse />
            <ReturnStageBadge stage={order.returnStage} audience="customer" className="text-sm" alwaysShow />
          </div>
          <p data-ui="account/MyOrderView/p-2" className="basis-full text-sm text-muted-foreground">
            {customerStatusLine(STATUS_META[order.status].description, order.returnStage, {
              canRequestAgain: order.status === "delivered" ? canRequestAgain(order.returnRequests, win.open) : undefined,
            })}
          </p>
        </div>

        {/* Progress gets the wide column; what you ordered + what you paid sits beside it. */}
        <div data-ui="account/MyOrderView/div-grid" className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div data-ui="account/MyOrderView/div-3" className="space-y-6">
            <ReturnRequestsPanel requests={order.returnRequests} orderCode={order.orderCode} phoneLast4={order.phone.slice(-4)} />
            <ReturnsList returns={order.returns} audience="customer" refundedInFull={order.returnStage?.key === "refunded"} />
            {order.cancellation && (
              <CancellationNotice cancellation={order.cancellation} paymentStatus={order.paymentStatus} audience="customer" />
            )}
            <PaymentPanel
              orderCode={order.orderCode}
              phoneLast4={order.phone.slice(-4)}
              total={order.total}
              orderStatus={order.status}
              payment={order}
              createdAt={order.createdAt}
            />
            <section data-ui="account/MyOrderView/section" aria-labelledby="progress-title" className="rounded-3xl border bg-card p-6 sm:p-8">
              <h3 data-ui="account/MyOrderView/h3-order-progress" id="progress-title" className="mb-6 font-sans text-lg font-semibold">
                Order progress
              </h3>
              <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} />
              <div data-ui="account/MyOrderView/div-4" className="mt-6 empty:hidden"><ReturnTimeline input={stageInputOf(order)} audience="customer" /></div>
              {/* Help + cancel live together, under the progress they relate to */}
              <div data-ui="account/MyOrderView/div-flex-4" className="mt-8 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:flex-wrap sm:items-center">
                <a data-ui="account/MyOrderView/a-ask-about-this-order"
                  href={shopWhatsappLink(shop, `Hi! I have a question about my order ${order.orderCode}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-full bg-whatsapp-solid px-6 text-sm font-semibold text-white sm:w-auto"
                >
                  <WhatsAppIcon className="size-4" /> Ask about this order
                </a>
                <RequestReturn
                  orderCode={order.orderCode}
                  status={order.status}
                  items={order.items}
                  returns={order.returns}
                  requests={order.returnRequests}
                  window={{ open: win.open, until: win.until ? win.until.toISOString() : null, days: shop.returnWindowDays }}
                  whatsappUrl={shopWhatsappLink(shop, `Hi! I have a question about returning my order ${order.orderCode}.`)}
                />
                <CancelOrder
                  orderCode={order.orderCode}
                  status={order.status}
                  paymentStatus={order.paymentStatus}
                  whatsappUrl={shopWhatsappLink(shop, `Hi! I want to cancel my order ${order.orderCode}.`)}
                />
              </div>
            </section>
          </div>

          <div data-ui="account/MyOrderView/div-5" className="space-y-6 xl:sticky-store xl:self-start">
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
    </section>
  )
}

// ---------------------------------------------------------------- invoice (customer and admin)

/** The printable bill page. `backHref` differs for the customer and the admin. */
export function InvoicePageView({ order, shop, backHref }: { order: Order; shop: StoreSettings; backHref: string }) {
  return (
    <div data-ui="account/InvoicePageView" className="space-y-4">
      <div data-ui="account/InvoicePageView/div-flex" className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 print:hidden">
        <Link data-ui="account/InvoicePageView/Link-back-to-order" href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to order
        </Link>
        {order.status !== "cancelled" && <PrintButton />}
      </div>
      {order.status === "cancelled" ? (
        <p data-ui="account/InvoicePageView/p" className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">This order was cancelled, so there is no invoice for it.</p>
      ) : (
        <InvoiceDocument order={order} shop={shop} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- profile

export function ProfileView({ profile, addresses }: { profile: Profile; addresses: Address[] }) {
  return (
    <section data-ui="account/ProfileView">
      <h2 data-ui="account/ProfileView/h2-profile-addresses" className="text-3xl font-semibold">Profile & addresses</h2>
      <p data-ui="account/ProfileView/p" className="mt-1 mb-8 text-muted-foreground">Manage your details and saved delivery addresses.</p>
      <div data-ui="account/ProfileView/div" className="space-y-8 sm:space-y-12">
        <section data-ui="account/ProfileView/section" aria-labelledby="profile-title" className="space-y-4">
          <h2 data-ui="account/ProfileView/h2-your-details" id="profile-title" className="text-2xl font-semibold">
            Your details
          </h2>
          <ProfileForm profile={profile} />
        </section>
        <AddressBook addresses={addresses} defaults={{ fullName: profile.fullName, phone: profile.phone }} />
      </div>
    </section>
  )
}

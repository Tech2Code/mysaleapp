import { RefundSummary } from "@/components/shared/refund-summary"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"
import { ArrowLeftIcon, ChevronRightIcon, PackageIcon, ReceiptTextIcon } from "lucide-react"
import Link from "next/link"
import { AddressBook } from "@/components/account/address-book"
import { ProfileOrSettingsView } from "@/components/account/account-nav"
import { ProfileForm } from "@/components/account/profile-form"
import { CustomerOrdersFilterBar, type CustomerOrderFilters, type CustomerOrderRenderItem } from "@/components/admin/order-filters"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { CopyButton } from "@/components/shared/copy-button"
import { RefreshButton } from "@/components/shared/refresh-button"
import { InvoiceDocument } from "@/components/shared/invoice-document"
import { OrderSummary } from "@/components/shared/order-summary"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { PrintButton } from "@/components/shared/print-button"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { CancelOrder } from "@/components/store/cancel-order"
import { DeliveryEditor } from "@/components/store/delivery-editor"
import { PaymentPanel } from "@/components/store/payment-panel"
import { RequestReturn, ReturnRequestsPanel } from "@/components/store/request-return"
import { buttonVariants } from "@/components/ui/button"
import type { Profile } from "@/features/account/schema"
import type { Address } from "@/features/addresses/types"
import { describeHours, formatDeadline, paymentDeadline } from "@/features/orders/deadline"
import { placeholderOrders } from "@/features/orders/placeholders"
import type { CustomerOrderStatusCounts } from "@/features/orders/queries"
import { canRequestAgain, customerStatusLine, stageInputOf } from "@/features/orders/returns"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { isAwaitingPayment, STATUS_META, stripOrderPrefix, type Order, type OrderWithHistory } from "@/features/orders/types"
import type { StoreSettings } from "@/features/settings/types"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./account.module.css"

/**
 * The signed-in customer's pages. Each is rendered by its page with real data and by its
 * loading.tsx (inside <Skeletonize>) with placeholder data, so the two always have the same layout.
 */

// ---------------------------------------------------------------- my orders

function MyOrderCard({ o, shop }: { o: Order; shop: StoreSettings }) {
  return (
    <Link
      href={`/account/orders/${o.orderCode}`}
      className={styles.myOrderCard}
    >
      <div className={styles.orderMainInfo}>
        <div className={styles.orderTopRow}>
          <span className={styles.orderCodeMono}>{o.orderCode}</span>
          <OrderStatusBadge status={o.status} returnStage={o.returnStage} paymentStatus={o.paymentStatus} audience="customer" />
        </div>
        <p className={styles.orderItemsTrunc}>
          {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
        </p>
        {o.returnStage?.badge && o.returnStage.active && (
          <p className={styles.returnStageNote}>{o.returnStage.customerDetail}</p>
        )}
        <p className={styles.orderDateNote}>{formatDate(o.createdAt)}</p>
        {isAwaitingPayment(o) && shop.unpaidOrderExpiryHours > 0 && (
          <p className={styles.deadlineWarning}>
            {shop.paymentMode === "gateway"
              ? `Complete payment by ${formatDeadline(paymentDeadline(o.createdAt, shop.unpaidOrderExpiryHours, o.updatedAt)!)} · unpaid orders are cancelled automatically after ${describeHours(shop.unpaidOrderExpiryHours)}`
              : o.paymentStatus === "failed"
                ? `Update UTR by ${formatDeadline(paymentDeadline(o.createdAt, shop.unpaidOrderExpiryHours, o.updatedAt)!)} · orders with a rejected payment are cancelled automatically after ${describeHours(shop.unpaidOrderExpiryHours)}`
                : `Submit UTR by ${formatDeadline(paymentDeadline(o.createdAt, shop.unpaidOrderExpiryHours, o.updatedAt)!)} · unpaid orders are cancelled automatically after ${describeHours(shop.unpaidOrderExpiryHours)}`}
          </p>
        )}
      </div>
      <span className={styles.orderTotalAmount}>{formatPrice(o.total)}</span>
      <ChevronRightIcon className={styles.chevronSvg} />
    </Link>
  )
}

function MyOrdersEmpty({
  isFiltered,
  showAllTimeButton = isFiltered,
}: {
  isFiltered: boolean
  showAllTimeButton?: boolean
}) {
  return (
    <div className={styles.emptyOrdersBox}>
      <PackageIcon className={styles.pkgIcon40} />
      <p className={styles.emptyHeading}>
        {isFiltered ? "No matching orders" : "No orders yet"}
      </p>
      <p className={styles.emptyCopy}>
        {isFiltered
          ? showAllTimeButton
            ? "Try switching the status tab above, or select Full FY / All time to see older orders."
            : "Try switching the status tab above or clearing your search query."
          : "Orders you place while signed in appear here. Guest orders can be tracked with their order code."}
      </p>
      {(showAllTimeButton || !isFiltered) && (
        <div className={styles.emptyActionsRow}>
          {showAllTimeButton && (
            <Link href="/account/orders?year=all" className={cn(buttonVariants({ variant: "secondary" }), styles.pillBtnPx20)}>
              View all-time orders
            </Link>
          )}
          {!isFiltered && (
            <Link href="/products" className={cn(buttonVariants(), styles.pillBtnPx20)}>
              Start shopping
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export function MyOrdersView({
  orders,
  shop,
  filters,
  statusCounts,
}: {
  orders: Order[]
  shop: StoreSettings
  filters?: CustomerOrderFilters
  statusCounts?: CustomerOrderStatusCounts
}) {
  const isPeriodFiltered = Boolean(filters?.year && filters.year !== "all")
  const items: CustomerOrderRenderItem[] = orders.map((o) => {
    const cancelRefundDue = o.status === "cancelled" && (o.paymentStatus === "paid" || o.paymentStatus === "submitted")
    const hasRefund =
      o.paymentStatus === "refunded" ||
      (o.refundedAmount ?? 0) > 0 ||
      Boolean(o.returnStage) ||
      cancelRefundDue
    const refundPending = Boolean(o.returnStage?.active) || cancelRefundDue
    const searchText = [
      o.orderCode,
      ...o.items.map((i) => `${i.name} ${i.slug}`),
      o.customerName,
      o.phone,
      o.address,
      o.city,
      o.pincode,
      o.note,
      String(o.total),
      formatPrice(o.total),
      formatDate(o.createdAt),
      o.shipping?.carrier,
      o.shipping?.trackingNumber,
      o.paymentReference,
      o.paymentNote,
      o.cancellation?.refundReference,
      o.cancellation?.reason,
      STATUS_META[o.status].label,
      o.returnStage?.customerLabel,
      o.returnStage?.customerDetail,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()

    return {
      id: o.id,
      category: o.status === "delivered" ? "delivered" : o.status === "cancelled" ? "cancelled" : "active",
      hasRefund,
      refundPending,
      searchText,
      node: <MyOrderCard o={o} shop={shop} />,
    }
  })
  const skeletonNode = (
    <ul className={styles.ordersSkeletonList}>
      {placeholderOrders(3).map((o) => (
        <li key={o.id}>
          <MyOrderCard o={o} shop={shop} />
        </li>
      ))}
    </ul>
  )

  return (
    <section>
      <h2 className={styles.ordersHeading}>My orders</h2>
      <CustomerOrdersFilterBar
        year={filters?.year}
        month={filters?.month}
        status={filters?.status}
        today={filters?.today}
        statusCounts={statusCounts}
        items={items}
        emptyPeriodNode={<MyOrdersEmpty isFiltered={isPeriodFiltered} showAllTimeButton={isPeriodFiltered} />}
        emptyTabNode={<MyOrdersEmpty isFiltered={true} showAllTimeButton={isPeriodFiltered} />}
        skeletonNode={skeletonNode}
      />
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
  win: { open: boolean; until: Date | null; days?: number }
}) {
  return (
    <section className={styles.singleOrderSection}>
      <Link data-back-link href="/account/orders" className={styles.backNavLink}>
        <ArrowLeftIcon className={styles.icon16} /> All orders
      </Link>
      <div className={styles.orderDetailStack}>
        <div className={styles.orderHeaderCard}>
          <div>
            <div className={styles.codeRow}>
              <h2 className={styles.codeHeading}>{order.orderCode}</h2>
              <CopyButton value={stripOrderPrefix(order.orderCode, shop.orderCodePrefix)} label="Order code" />
            </div>
            <p className={styles.placedSubtext}>Placed on {formatDate(order.createdAt)}</p>
          </div>
          <div className={styles.headerActionsGroup}>
            <RefreshButton />
            {order.status !== "cancelled" && (
              <Link href={`/account/orders/${order.orderCode}/invoice`} className={styles.invoicePillLink}>
                <ReceiptTextIcon className={styles.icon16} /> Invoice
              </Link>
            )}
            <OrderStatusBadge status={order.status} returnStage={order.returnStage} paymentStatus={order.paymentStatus} audience="customer" className={styles.badgeTextSm} pulse alwaysShow />
          </div>
          <p className={styles.statusDescriptionLine}>
            {customerStatusLine(STATUS_META[order.status].description, order.returnStage, {
              canRequestAgain: order.status === "delivered" ? canRequestAgain(order.returnRequests, win.open) : undefined,
            })}
          </p>
        </div>

        {/* Progress gets the wide column; what you ordered + what you paid sits beside it. */}
        <div className={styles.orderTwoColGrid}>
          <div className={styles.leftMainCol}>
            <ReturnRequestsPanel requests={order.returnRequests} returns={order.returns} refundedInFull={order.returnStage?.key === "refunded"} orderCode={order.orderCode} />
            <RefundSummary order={order} />
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
              updatedAt={order.updatedAt}
            />
            <section aria-labelledby="progress-title" className={styles.progressCard}>
              <h3 id="progress-title" className={styles.progressTitle}>
                Order progress
              </h3>
              <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} returnInput={stageInputOf(order)} audience="customer" />
              {/* Help + cancel live together, under the progress they relate to */}
              <div className={styles.progressFooterActions}>
                <a
                  href={shopWhatsappLink(shop, `Hi! I have a question about my order ${order.orderCode}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "whatsapp", size: "lg" })}
                >
                  <WhatsAppIcon className={styles.icon16} aria-hidden="true" /> Ask about this order
                </a>
                <RequestReturn
                  orderCode={order.orderCode}
                  status={order.status}
                  items={order.items}
                  history={order.history}
                  returns={order.returns}
                  requests={order.returnRequests}
                  charges={{
                    shippingFee: order.shippingFee,
                    extraFees: order.extraFees,
                    discountAmount: order.discountAmount,
                    paidAmount: order.paymentAmount ?? order.total,
                    refundedAmount: order.refundedAmount,
                  }}
                  orderDelivery={{
                    name: order.customerName,
                    phone: order.phone,
                    address: order.address,
                    city: order.city,
                    pincode: order.pincode,
                  }}
                  window={{ open: win.open, until: win.until ? win.until.toISOString() : null, days: win.days ?? shop.returnWindowDays }}
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

          <div className={styles.rightSidebarCol}>
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
              status={order.status}
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
    <div className={styles.invoicePageStack}>
      <div className={styles.invoiceTopBar}>
        <Link data-back-link href={backHref} className={styles.backNavLink}>
          <ArrowLeftIcon className={styles.icon16} /> Back to order
        </Link>
        {order.status !== "cancelled" && <PrintButton />}
      </div>
      {order.status === "cancelled" ? (
        <p className={styles.cancelledInvoiceNotice}>This order was cancelled, so there is no invoice for it.</p>
      ) : (
        <InvoiceDocument order={order} shop={shop} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- profile

export function ProfileView({ profile, addresses }: { profile: Profile; addresses: Address[] }) {
  return (
    <ProfileOrSettingsView
      profileContent={
        <section>
          <h2 className={styles.ordersHeading}>Profile</h2>
          <p className={styles.profileHeaderLead}>Manage your personal details, contact number, and login password.</p>
          <ProfileForm profile={profile} />
        </section>
      }
      addressesContent={
        <section>
          <AddressBook addresses={addresses} defaults={{ fullName: profile.fullName, phone: profile.phone }} />
        </section>
      }
    />
  )
}

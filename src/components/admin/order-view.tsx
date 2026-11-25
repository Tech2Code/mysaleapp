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
import styles from "./admin-orders.module.css"

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={`adminCard ${styles.orderCard}`}>
      {title && (
        <div className={styles.orderCardHeader}>
          <h2 className={styles.orderCardTitle}>{title}</h2>
        </div>
      )}
      <div className={styles.orderCardBody}>{children}</div>
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
    <div className={styles.paymentBox}>
      <PaymentControl key={`pay-${order.paymentStatus}-${order.updatedAt}`} order={order} />
    </div>
  )
  const version = `${order.status}-${order.paymentStatus}-${order.updatedAt}`

  return (
    <>
      <Link data-back-link href="/admin/orders" className={styles.backLink}>
        <ArrowLeftIcon className={styles.iconMd} /> All orders
      </Link>

      <header className={`adminCard ${styles.orderHeaderCard}`}>
        <div className={styles.headerMainGroup}>
          <h1 className={styles.orderHeading}>{order.orderCode}</h1>
          <CopyButton value={order.orderCode} label="Order ID" />
          <div className={styles.statusBadgeWrap}>
            <OrderStatusBadge status={order.status} returnStage={order.returnStage} paymentStatus={order.paymentStatus} audience="admin" className={styles.statusBadgeSm} pulse alwaysShow />
          </div>
          <span className={styles.placedText}>Placed {formatDateTime(order.createdAt)}</span>
        </div>
        <div className={styles.headerRightGroup}>
          {autoCancelAt && (
            <span className={styles.autoCancelBadge}>
              Auto-cancels {formatDeadline(autoCancelAt)} if UTR not updated
            </span>
          )}
          {order.status !== "cancelled" && (
            <Link href={`/admin/orders/${encodeURIComponent(order.orderCode)}/invoice`} className={styles.invoiceBtn}>
              <ReceiptTextIcon className={styles.iconMd} /> Invoice
            </Link>
          )}
        </div>
      </header>

      <div className={styles.orderDetailGrid}>
        <div className={styles.mainWorkCol}>
          {order.cancellation && (
            <CancellationNotice cancellation={order.cancellation} paymentStatus={order.paymentStatus} audience="admin" />
          )}
          {/* ONE work card. Left: payment, status, cancel. STICKY: it follows the reader while the long timeline scrolls on the right
              (a sticky box only moves while the right side is taller; capped to the screen so it scrolls inside itself if it is taller). */}
          <Card title="Fulfilment">
            <div className={styles.fulfilmentGrid}>
              <div className={styles.fulfilmentLeftCol}>
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
                      paymentReference={order.paymentReference}
                      refundedAmount={order.refundedAmount}
                      discountAmount={order.discountAmount}
                      paidAmount={order.paymentAmount ?? order.total}
                      items={order.items}
                      requests={order.returnRequests}
                      returns={order.returns}
                      stage={order.returnStage}
                    />
                  }
                />
                {!paymentFirst && paymentSection}
                {CANCELLABLE_BY_ADMIN.includes(order.status) && (
                <div className={styles.cancelDivider}>
                  <AdminCancelOrder
                    orderId={order.id}
                    orderCode={order.orderCode}
                    status={order.status}
                    paidOrSent={order.paymentStatus === "paid" || order.paymentStatus === "submitted"}
                  />
                </div>
                )}
              </div>
              <div className={styles.fulfilmentRightCol}>
                <div>
                  <h3 className={styles.progressHeading}>Progress</h3>
                  <OrderTimeline status={order.status} history={order.history} shipping={order.shipping} shippingAction={order.status === "shipped" && order.shipping ? <CourierEditButton orderId={order.id} shipping={order.shipping} /> : undefined} returnInput={stageInputOf(order)} audience="admin" />
                </div>
              </div>
            </div>
          </Card>
          <AdminReturnRequests
            requests={order.returnRequests}
            returns={order.returns}
            returnStage={order.returnStage}
            admin={{
              items: order.items,
              paymentStatus: order.paymentStatus,
              refundedAmount: order.refundedAmount,
              discountAmount: order.discountAmount,
              paidAmount: order.paymentAmount ?? order.total,
              paymentReference: order.paymentReference,
              customerName: order.customerName,
              orderCode: order.orderCode,
            }}
          />
          <RefundSummary order={order} audience="admin" />
          <OrderSummary order={order} openLinksInNewTab audience="admin" />
        </div>

        <aside className={styles.sideCustomerCol}>
          <Card title="Customer">
            <p className={styles.customerNameText}>{order.customerName}</p>
            <p className={styles.customerPhoneText}>+91 {order.phone}</p>
            <p className={styles.customerAccountType}>{order.userId ? "Signed-in customer" : "Guest checkout"}</p>
            <div className={styles.contactBtnRow}>
              <a
                href={whatsappLink(`91${order.phone}`)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.whatsappContactBtn}
              >
                <WhatsAppIcon className={styles.iconMd} /> WhatsApp
              </a>
              <a href={`tel:+91${order.phone}`} className={styles.callContactBtn}>
                <PhoneIcon className={styles.iconMd} /> Call
              </a>
            </div>
          </Card>

          <Card title="Ship to">
            <p className={styles.addressLine}>{order.address}</p>
            <p className={styles.addressLine}>
              {order.city} - {order.pincode}
            </p>
            {order.deliveryUpdatedAt && (
              <p className={styles.deliveryUpdatedBadge}>
                Customer updated this on {formatDateTime(order.deliveryUpdatedAt)}
              </p>
            )}
            {order.note && (
              <p className={styles.customerNoteBox}>
                <span className={styles.noteLabel}>Customer note:</span> {order.note}
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

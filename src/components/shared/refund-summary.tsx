import { InfoIcon, WalletIcon } from "lucide-react"
import { refundBreakdown } from "@/features/orders/refund"
import type { OrderFee, OrderItem, OrderReturn, ReturnRequest } from "@/features/orders/types"
import { formatPrice } from "@/lib/format"
import styles from "./shared.module.css"

/**
 * "How much will I get back?" for an order with a return, for customers, guests and the admin:
 * what was paid, the refund per returned item, what is NOT refunded (delivery and other charges) and
 * the amount that goes back. Items only: charges are never refunded.
 */
export function RefundSummary({
  order,
  audience = "customer",
}: {
  order: {
    items: OrderItem[]
    returnRequests: ReturnRequest[]
    returns: OrderReturn[]
    shippingFee: number
    extraFees: OrderFee[]
    discountAmount?: number
    total: number
    paymentAmount: number | null
    refundedAmount: number
  }
  audience?: "customer" | "admin"
}) {
  const b = refundBreakdown(order)
  if (!b) return null
  const done = b.basis === "returned"

  return (
    <section aria-label="Refund details" className={styles.sharedPanelCard}>
      <h3 className={styles.panelHeading}>
        <WalletIcon className={styles.primaryIcon} aria-hidden /> Refund details
      </h3>
      <p className={styles.refundRow}>
        <span className={styles.mutedSpan}>Order total paid</span>
        <span className={styles.mediumSpan}>{formatPrice(b.paid)}</span>
      </p>

      <div className={styles.refundSectionBlock}>
        <p className={styles.kickerLabel}>
          {done ? "Items returned" : audience === "admin" ? "Items being returned" : "Items you are returning"}
        </p>
        <ul className={styles.refundLinesUl}>
          {b.lines.map((l) => (
            <li key={l.productId} className={styles.refundLineLi}>
              <span className={styles.minW0}>
                {l.name} <span className={styles.mutedSpan}>({l.quantity} × {formatPrice(l.unitPrice)})</span>
              </span>
              <span className={styles.shrink0Medium}>{formatPrice(l.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {b.promoDiscountShare > 0 && (
        <p className={styles.promoShareRow}>
          <span>Promo discount applied</span>
          <span className={styles.shrink0Medium}>−{formatPrice(b.promoDiscountShare)}</span>
        </p>
      )}

      {b.notRefunded.length > 0 && (
        <div className={styles.refundSectionBlock}>
          <p className={styles.kickerLabel}>Not refunded</p>
          <ul className={styles.refundLinesUl}>
            {b.notRefunded.map((c, i) => (
              <li key={`${c.label}-${i}`} className={styles.refundLineMutedLi}>
                <span className={styles.minW0}>{c.label}</span>
                <span className={styles.shrink0}>{formatPrice(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.refundableTotalRow}>
        <span>{done ? "Refund for these items" : audience === "admin" ? "Refund to customer" : b.alreadyRefunded > 0 ? "Cumulative refund" : "You get back"}</span>
        <span>{formatPrice(b.refundable)}</span>
      </p>
      {b.alreadyRefunded > 0 && (
        <p className={styles.alreadyRefundedRow}>
          <span>Already refunded</span>
          <span>{formatPrice(b.alreadyRefunded)}</span>
        </p>
      )}
      {!done && b.alreadyRefunded > 0 && (
        <p className={styles.alreadyRefundedRow}>
          <span>Refund for this request</span>
          <span>{formatPrice(Math.max(0, Math.round((b.refundable - b.alreadyRefunded + Number.EPSILON) * 100) / 100))}</span>
        </p>
      )}
      <p className={styles.refundFootnote}>
        <InfoIcon className={styles.infoIcon} aria-hidden />
        <span>A return refunds only the price of the returned items. Delivery and other charges are not refunded.</span>
      </p>
    </section>
  )
}

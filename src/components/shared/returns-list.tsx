import { ArrowLeftRightIcon, PackageOpenIcon } from "lucide-react"
import { RefundReturnButton } from "@/components/admin/refund-return-button"
import { netReturnRefund } from "@/features/orders/refund"
import type { OrderItem, OrderReturn } from "@/features/orders/types"
import { formatDateTime, formatPrice } from "@/lib/format"
import styles from "./shared.module.css"

/** Item value of one return, priced from the order's lines (what the database refunds for it). */
function returnValue(
  r: OrderReturn,
  items: OrderItem[],
  returns: OrderReturn[],
  discountAmount = 0,
  alreadyRefunded = 0,
  paidAmount?: number
): number {
  const prior = returns.filter((o) => o.refunded && o.id !== r.id).flatMap((o) => o.items)
  return netReturnRefund(items, r.items, { discountAmount, paidAmount, alreadyRefunded, priorReturnedLines: prior })
}

/**
 * Goods that came back for an order. The admin also sees whether each item went back into stock;
 * the customer sees what was returned and whether the refund was made.
 */
export function ReturnsList({
  returns,
  audience,
  admin,
  refundedInFull = false,
  bare = false,
}: {
  returns: OrderReturn[]
  audience: "customer" | "admin"
  /** Customer view: say "Refund done" only when the whole order is refunded (else "Part refunded"). */
  refundedInFull?: boolean
  /** Admin only: lets a return recorded without a refund be refunded later (the order must still be 'paid'). */
  admin?: {
    items: OrderItem[]
    paymentStatus: string
    refundedAmount: number
    discountAmount?: number
    paidAmount?: number
    refundUpiId?: string | null
    paymentReference?: string | null
    customerName?: string
    orderCode?: string
  }
  /** Rendered inside another card (the Returns card): no outer card, a small sub-heading instead. */
  bare?: boolean
}) {
  if (returns.length === 0) return null
  const Wrapper = bare ? "div" : "section"
  return (
    <Wrapper aria-label="Items received back" className={bare ? styles.sharedPanelBare : styles.sharedPanelCard}>
      {bare ? (
        <h4 className={styles.panelSubheading}>Items received back</h4>
      ) : (
        <h3 className={styles.panelHeading}>
          <PackageOpenIcon className={styles.primaryIcon} aria-hidden /> Items received back
        </h3>
      )}
      <ul className={styles.returnsListUl}>
        {returns.map((r) => (
          <li key={r.id} className={styles.returnCardLi}>
            <p className={styles.receivedAtText}>Received {formatDateTime(r.createdAt)}</p>
            <ul className={styles.returnedItemsUl}>
              {r.items.map((i) => (
                <li key={i.productId} className={styles.returnedItemLi}>
                  <span>
                    {i.quantity} × {i.name}
                  </span>
                  {audience === "admin" && (
                    <span className={i.restock ? styles.restockSuccess : styles.restockMuted}>
                      {i.restock ? "Back in stock" : "Not restocked"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {r.reason && <p className={styles.returnReasonText}>Reason: {r.reason}</p>}
            {r.refunded ? (
              <p className={styles.refundSuccessText}>
                {audience === "admin"
                  ? r.refundAmount
                    ? `Refunded ${formatPrice(r.refundAmount)}`
                    : "Refund done"
                  : refundedInFull
                    ? "Refund done"
                    : "Part refunded"}
              </p>
            ) : r.resolutionType === "exchange" ? (
              <p className={styles.exchangeBadgeText}>
                <ArrowLeftRightIcon className={styles.icon14} aria-hidden /> Returned for exchange
              </p>
            ) : (
              audience === "admin" && (
                <div className={styles.adminRefundRow}>
                  <p className={styles.noRefundText}>No refund recorded</p>
                  {admin && admin.paymentStatus === "paid" && (
                    <RefundReturnButton
                      returnId={r.id}
                      value={returnValue(r, admin.items, returns, admin.discountAmount ?? 0, admin.refundedAmount, admin.paidAmount)}
                      expectedRefunded={admin.refundedAmount}
                      refundUpiId={admin.refundUpiId}
                      paymentReference={admin.paymentReference}
                      customerName={admin.customerName}
                      orderCode={admin.orderCode}
                    />
                  )}
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </Wrapper>
  )
}

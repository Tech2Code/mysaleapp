import { isOrderLocked } from "./locking"
import { PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./types"

/**
 * Which payment states an admin may move an order's payment to. One rule set for the manual-payment form
 * (what to offer), the server action (what to refuse) and the DB trigger `guard_payment_status` (0024).
 *   paid     -> paid | refunded      (never back to unpaid: record a refund instead)
 *   refunded -> refunded             (terminal)
 *   unpaid   -> anything, except that a cancelled order can't become paid / submitted
 */
export function allowedPaymentStatuses(o: { status: OrderStatus; paymentStatus: PaymentStatus }): PaymentStatus[] {
  if (o.paymentStatus === "refunded") return ["refunded"]
  if (o.paymentStatus === "paid") return ["paid", "refunded"]
  if (o.status === "cancelled") return PAYMENT_STATUSES.filter((s) => s === o.paymentStatus || s === "pending" || s === "failed")
  return [...PAYMENT_STATUSES].filter((s) => s !== "refunded")
}

/** After delivery / cancellation the received amount, paid time and UTR of a paid order never change. */
export const isPaymentMoneyLocked = (o: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean =>
  isOrderLocked(o.status) && (o.paymentStatus === "paid" || o.paymentStatus === "refunded")

/** Short reason shown next to the manual payment form. null = nothing to say. */
export function paymentEditNote(o: { status: OrderStatus; paymentStatus: PaymentStatus }): string | null {
  if (o.paymentStatus === "refunded") return "Refunded — the payment record can't be changed any more."
  if (o.paymentStatus === "paid") {
    return isOrderLocked(o.status)
      ? "Paid and the order is closed — the amount and reference are locked. The payment can only be refunded."
      : "Paid — it can only be refunded, not set back to unpaid."
  }
  if (o.status === "cancelled") return "Cancelled — a payment can't be recorded, only rejected."
  return null
}

const same = (a: number | null, b: number | null) => (a == null || b == null ? a == b : Math.abs(a - b) < 0.005)

/** null = allowed, otherwise the message for the admin. `next.amount/reference` are what the form sent (null = blank). */
export function paymentUpdateProblem(
  current: { status: OrderStatus; paymentStatus: PaymentStatus; paymentAmount: number | null; paymentReference: string | null },
  next: { status: PaymentStatus; amount: number | null; reference: string | null }
): string | null {
  if (!allowedPaymentStatuses(current).includes(next.status)) {
    if (current.paymentStatus === "refunded") return "This payment is refunded and can't be changed any more."
    if (next.status === "refunded") return "Only a paid order can be refunded."
    if (current.paymentStatus === "paid") return "A paid order can't go back to unpaid. If you sent the money back, record a refund instead."
    return "This order is cancelled. Record a refund instead of a payment."
  }
  if (isPaymentMoneyLocked(current) && current.paymentStatus === "paid" && next.status === "paid") {
    if (next.amount !== null && !same(next.amount, current.paymentAmount)) return "The received amount is locked once the order is delivered or cancelled."
    if ((next.reference ?? null) !== (current.paymentReference ?? null)) return "The UTR / reference is locked once the order is delivered or cancelled."
  }
  return null
}

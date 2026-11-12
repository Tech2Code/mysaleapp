import { isOrderLocked } from "./locking"
import { PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./types"

/**
 * Which payment states an admin may move an order's payment to. One rule set for the manual-payment form
 * (what to offer), the server action (what to refuse) and the DB trigger `guard_payment_status` (0024).
 *   paid     -> paid | refunded      (never back to unpaid: record a refund instead). Refunded only once the order is shipped,
 *                                    delivered or cancelled: before dispatch (pending / confirmed / packed) the order must be CANCELLED first,
 *                                    otherwise it would still be packed and sent with no money behind it.
 *   refunded -> refunded             (terminal)
 *   unpaid   -> anything, except that a cancelled order can't become paid / submitted (a submitted payment may be confirmed as paid so it can be refunded)
 */
/** Order statuses in which a paid payment may be marked refunded from the payment form (only once cancelled; delivered orders are refunded via the return flow). */
export const REFUNDABLE_STATUSES: OrderStatus[] = ["cancelled"]

export function allowedPaymentStatuses(o: { status: OrderStatus; paymentStatus: PaymentStatus }): PaymentStatus[] {
  if (o.paymentStatus === "refunded") return ["refunded"]
  if (o.paymentStatus === "paid") return REFUNDABLE_STATUSES.includes(o.status) ? ["paid", "refunded"] : ["paid"]
  if (o.status === "cancelled") {
    // A payment the customer already sent (UTR submitted) before cancelling can still be confirmed as received, so the refund can be recorded.
    return PAYMENT_STATUSES.filter((s) => s === o.paymentStatus || s === "pending" || s === "failed" || (s === "paid" && o.paymentStatus === "submitted"))
  }
  return [...PAYMENT_STATUSES].filter((s) => s !== "refunded")
}

/** After delivery / cancellation the received amount, paid time and UTR of a paid order never change. */
export const isPaymentMoneyLocked = (o: { status: OrderStatus; paymentStatus: PaymentStatus }): boolean =>
  isOrderLocked(o.status) && (o.paymentStatus === "paid" || o.paymentStatus === "refunded")

/** Short reason shown next to the manual payment form. null = nothing to say. */
export function paymentEditNote(o: { status: OrderStatus; paymentStatus: PaymentStatus }): string | null {
  if (o.paymentStatus === "refunded") return "Refunded — the payment record can't be changed any more."
  if (o.paymentStatus === "paid") {
    if (o.status === "cancelled") {
      return "Paid and cancelled — the amount and reference are locked. The payment can only be refunded."
    }
    if (o.status === "delivered") {
      return "Paid and delivered — the amount and reference are locked. Delivered orders are refunded through the return flow."
    }
    return "Paid — payment status is locked. It can only be refunded once the order is cancelled."
  }
  if (o.status === "cancelled") {
    return o.paymentStatus === "submitted"
      ? "Cancelled, but the customer had sent a payment. If the money reached you, mark it paid, then refund it. Otherwise reject it."
      : "Cancelled — a payment can't be recorded, only rejected."
  }
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
    if (next.status === "refunded" && current.paymentStatus === "paid") {
      return current.status === "delivered"
        ? "Delivered orders are refunded through the return flow, not from the payment form."
        : "To refund this payment, cancel the order first. The refund is recorded after the cancellation."
    }
    if (next.status === "refunded") return "Only a paid, cancelled order can be refunded."
    if (current.paymentStatus === "paid") return "A paid order can't go back to unpaid. If you sent the money back, cancel the order and record a refund instead."
    return "This order is cancelled. Record a refund instead of a payment."
  }
  if (isPaymentMoneyLocked(current) && current.paymentStatus === "paid" && next.status === "paid") {
    if (next.amount !== null && !same(next.amount, current.paymentAmount)) return "The received amount is locked once the order is delivered or cancelled."
    if ((next.reference ?? null) !== (current.paymentReference ?? null)) return "The UTR / reference is locked once the order is delivered or cancelled."
  }
  return null
}

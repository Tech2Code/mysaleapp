import type { OrderStatus, PaymentStatus } from "./types"

export type PaymentDue = { label: string; amount: number } | null

/**
 * The "to collect / refunded" line of the admin payment card. Null = nothing to show:
 * paid in full, or cancelled with nothing paid (cancelled + paid is the "refund due" box instead).
 */
export function paymentDue(o: {
  status: OrderStatus
  paymentStatus: PaymentStatus
  total: number
  paymentAmount: number | null
  refundedAmount: number
}): PaymentDue {
  const { status, paymentStatus, total, paymentAmount, refundedAmount } = o
  if (paymentStatus === "refunded") return { label: "Refunded", amount: refundedAmount > 0 ? refundedAmount : (paymentAmount ?? total) }
  if (status === "cancelled") return null
  if (paymentStatus === "paid") {
    if (refundedAmount > 0) return { label: "Refunded so far", amount: refundedAmount }
    const short = Math.round((total - (paymentAmount ?? total)) * 100) / 100
    return short > 0.005 ? { label: "Still to collect", amount: short } : null
  }
  return { label: "To collect", amount: total }
}

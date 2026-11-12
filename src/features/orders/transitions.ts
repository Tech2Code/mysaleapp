import type { OrderStatus, PaymentStatus } from "./types"

/**
 * The only moves an order can make. One table, used by the admin form (which options to show)
 * and by the server action (which refuses anything else). "Cancelled" is NOT here: orders are
 * cancelled through the cancel flow (with a reason), never by picking a status.
 */
export const NEXT_STATUSES: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed"],
  confirmed: ["packed", "shipped"],
  packed: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
}

/** One-step-back fulfilment revert allowed for admins (delivered -> shipped -> packed -> confirmed -> pending). */
export const PREVIOUS_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: "pending",
  packed: "confirmed",
  shipped: "packed",
  delivered: "shipped",
}

export function previousStatusOf(from: OrderStatus): OrderStatus | null {
  return PREVIOUS_STATUS[from] ?? null
}

export function isRevertTransition(from: OrderStatus, to: OrderStatus): boolean {
  return PREVIOUS_STATUS[from] === to
}

/** Until the parcel is packed, an order can still be cancelled by the customer; the admin can until it ships. */
export const CANCELLABLE_BY_CUSTOMER: readonly OrderStatus[] = ["pending", "confirmed"]
export const CANCELLABLE_BY_ADMIN: readonly OrderStatus[] = ["pending", "confirmed", "packed"]

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "Delivery is taking too long",
  "Want to change the product or address",
  "Payment problem",
  "Other",
] as const

export const ADMIN_CANCEL_REASONS = [
  "Customer asked to cancel",
  "Item out of stock",
  "Payment not received",
  "Unable to deliver to this address",
  "Duplicate order",
  "Other",
] as const

/** Statuses that need a verified (paid) payment. */
const NEEDS_PAYMENT: readonly OrderStatus[] = ["confirmed", "packed", "shipped", "delivered"]

export type TransitionCheck = { from: OrderStatus; to: OrderStatus; payment: PaymentStatus; hasCourier: boolean }

/** null = allowed, otherwise the message to show. */
export function checkTransition({ from, to, payment, hasCourier }: TransitionCheck): string | null {
  if (from === to) return null
  if (to === "cancelled") return "Use “Cancel order” to cancel, so the customer gets a reason and refund details."
  if (!NEXT_STATUSES[from].includes(to)) {
    return from === "cancelled" || from === "delivered"
      ? `A ${from} order can't be changed any more.`
      : `An order can't go from ${from} to ${to}.`
  }
  if (NEEDS_PAYMENT.includes(to) && payment !== "paid") {
    // later steps too: a payment that was refunded in the meantime must not let the parcel go out
    return payment === "refunded"
      ? "This payment was refunded, so the order can't go forward. Cancel the order instead."
      : "Payment isn't verified yet. Mark the payment as paid first: that also confirms the order."
  }
  if (to === "shipped" && !hasCourier) return "Add the courier name before marking the order as shipped."
  return null
}

/** The statuses to offer in the dropdown for an order that is currently `from` (including 1-step revert for active orders). */
export function statusChoices(from: OrderStatus): OrderStatus[] {
  const prev = previousStatusOf(from)
  return [from, ...NEXT_STATUSES[from], ...(prev && from !== "delivered" ? [prev] : [])]
}

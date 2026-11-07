import type { OrderStatus } from "./types"

/**
 * Edit lock for finished orders (one rule, three layers: UI, server actions, DB trigger `lock_finished_orders`
 * in migration 0023).
 *
 * Once an order is delivered or cancelled its facts are frozen: shipping (courier, tracking, expected
 * delivery), items and prices, customer name / phone / address. Still possible afterwards: the private admin
 * note (separate table), payments and refunds, recording returns and deciding return requests.
 */
export const LOCKED_STATUSES: readonly OrderStatus[] = ["delivered", "cancelled"]

export const isOrderLocked = (status: OrderStatus): boolean => LOCKED_STATUSES.includes(status)

/** Short note shown next to locked fields. null when the order can still be edited. */
export function lockNote(status: OrderStatus): string | null {
  if (status === "delivered") return "Delivered — details are locked."
  if (status === "cancelled") return "Cancelled — details are locked."
  return null
}

/** Friendly refusal for a server action that tried to change a locked order. null when allowed. */
export function lockedMessage(status: OrderStatus): string | null {
  if (status === "delivered") {
    return "This order is delivered, so its shipping and delivery details are locked. You can still add a note, record a return or a refund."
  }
  if (status === "cancelled") {
    return "This order is cancelled, so its details are locked. You can still record a refund and add a note."
  }
  return null
}

import type { OrderItem, OrderReturn, ReturnRequest, ReturnRequestStatus, StatusHistoryEntry } from "./types"

/**
 * Return rules in one place (pure functions, used by pages, client components and server actions).
 * The database enforces the same rules (migration 0012); this is what lets the UI show the right thing first.
 */

export const RETURN_REASONS = [
  "Damaged or broken",
  "Not as described",
  "Wrong item received",
  "Quality isn't what I expected",
  "Changed my mind",
  "Other",
] as const

export const RETURN_STATUS_META: Record<ReturnRequestStatus, { label: string; tone: "info" | "success" | "danger" | "neutral" }> = {
  requested: { label: "Waiting for approval", tone: "info" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Not approved", tone: "danger" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
  received: { label: "Return received", tone: "success" },
}

/** A request that still needs attention (counts against "one open request per order"). */
export const isOpenRequest = (r: Pick<ReturnRequest, "status">) => r.status === "requested" || r.status === "approved"

/** When the order was delivered: the latest "delivered" entry in its history. */
export function deliveredAt(history: StatusHistoryEntry[]): string | null {
  const times = history.filter((h) => h.status === "delivered").map((h) => h.changedAt)
  return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null
}

/**
 * The return window: `until` is the last moment a request can be made; `open` is whether that is still ahead.
 * `now` is passed in so callers read the clock themselves (after connection() in server components).
 */
export function returnWindow(history: StatusHistoryEntry[], windowDays: number, now: Date): { until: Date | null; open: boolean } {
  const delivered = deliveredAt(history)
  if (!delivered || windowDays <= 0) return { until: null, open: false }
  const until = new Date(new Date(delivered).getTime() + windowDays * 86_400_000)
  return { until, open: now.getTime() <= until.getTime() }
}

/** How many of each product can still be sent back: ordered minus goods already received back. */
export function returnableQuantities(items: OrderItem[], returns: OrderReturn[]): Map<string, number> {
  const left = new Map<string, number>()
  for (const i of items) left.set(i.productId, (left.get(i.productId) ?? 0) + i.quantity)
  for (const r of returns) for (const i of r.items) left.set(i.productId, (left.get(i.productId) ?? 0) - i.quantity)
  return left
}

import { isOpenRequest } from "./returns"
import type { OrderFee, OrderItem, OrderReturn, ReturnRequest } from "./types"

/**
 * What a return refunds, in one place (pure; the SQL `record_order_return` / `refund_return` use the same rule):
 * the ITEMS only, price x quantity. Delivery and other charges are never refunded.
 */

export type RefundLine = { productId: string; name: string; quantity: number; unitPrice: number; amount: number }
export type NotRefunded = { label: string; amount: number }

const round2 = (n: number) => Math.round(n * 100) / 100

/** The price of a product on the order (the highest line price, like the database does). */
const unitPriceOf = (items: OrderItem[], productId: string): number =>
  Math.max(0, ...items.filter((o) => o.productId === productId).map((o) => o.price))

/** Price the given lines from the order's items. */
export function refundLines(items: OrderItem[], lines: { productId: string; name: string; quantity: number }[]): RefundLine[] {
  const merged = new Map<string, RefundLine>()
  for (const l of lines) {
    if (l.quantity < 1) continue
    const unit = unitPriceOf(items, l.productId)
    const quantity = (merged.get(l.productId)?.quantity ?? 0) + l.quantity
    merged.set(l.productId, { productId: l.productId, name: l.name, quantity, unitPrice: unit, amount: round2(quantity * unit) })
  }
  return [...merged.values()]
}

/** What stays with the shop on a return: the delivery charge and every extra charge that was paid. */
export function notRefundedCharges(pricing: { shippingFee: number; extraFees: OrderFee[] }): NotRefunded[] {
  return [
    ...(pricing.shippingFee > 0 ? [{ label: "Delivery charge", amount: pricing.shippingFee }] : []),
    ...pricing.extraFees
      .filter((f) => f.amount > 0)
      .map((f) => ({ label: f.productName ? `${f.label} (${f.productName})` : f.label, amount: f.amount })),
  ]
}

export type RefundBreakdown = {
  /** "request": a request still being handled; "returned": goods already received back. */
  basis: "request" | "returned"
  lines: RefundLine[]
  itemsTotal: number
  notRefunded: NotRefunded[]
  notRefundedTotal: number
  /** What the customer gets back for these lines (= itemsTotal). */
  refundable: number
  /** What was paid for the order. */
  paid: number
  /** Money already sent back for this order. */
  alreadyRefunded: number
}

/** The refund picture of an order's return, or null when there is no return activity to talk about. */
export function refundBreakdown(o: {
  items: OrderItem[]
  returnRequests: ReturnRequest[]
  returns: OrderReturn[]
  shippingFee: number
  extraFees: OrderFee[]
  total: number
  paymentAmount: number | null
  refundedAmount: number
}): RefundBreakdown | null {
  const open = o.returnRequests.find(isOpenRequest)
  const returnedItems = o.returns.flatMap((r) => r.items)
  const source = open ? [...returnedItems, ...open.items] : returnedItems
  if (source.length === 0) return null
  const lines = refundLines(o.items, source)
  const itemsTotal = round2(lines.reduce((n, l) => n + l.amount, 0))
  const notRefunded = notRefundedCharges(o)
  return {
    basis: open ? "request" : "returned",
    lines,
    itemsTotal,
    notRefunded,
    notRefundedTotal: round2(notRefunded.reduce((n, c) => n + c.amount, 0)),
    refundable: itemsTotal,
    paid: o.paymentAmount ?? o.total,
    alreadyRefunded: o.refundedAmount,
  }
}

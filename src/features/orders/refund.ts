import { isOpenRequest } from "./returns"
import type { OrderFee, OrderItem, OrderReturn, ReturnRequest } from "./types"

/**
 * What a return refunds, in one place (pure; the SQL `record_order_return` / `refund_return` use the same rule):
 * the ITEMS only, price x quantity. Delivery and other charges are never refunded.
 */

export type RefundLine = { productId: string; variantId?: string | null; name: string; quantity: number; unitPrice: number; amount: number }
export type NotRefunded = { label: string; amount: number }

const round2 = (n: number) => Math.round((n + (n >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100

/** The price of a product (or specific variant) on the order, matching the database `return_items_value` rule. */
const unitPriceOf = (items: OrderItem[], productId: string, variantId?: string | null): number => {
  const matched = variantId
    ? items.filter((o) => o.productId === productId && o.variantId === variantId)
    : items.filter((o) => o.productId === productId)
  const pool = matched.length > 0 ? matched : items.filter((o) => o.productId === productId)
  return Math.max(0, ...pool.map((o) => o.price))
}

/** Price the given lines from the order's items. */
export function refundLines(
  items: OrderItem[],
  lines: { productId: string; variantId?: string | null; name: string; quantity: number }[]
): RefundLine[] {
  const merged = new Map<string, RefundLine>()
  for (const l of lines) {
    if (l.quantity < 1) continue
    const key = l.variantId ? `${l.productId}::${l.variantId}` : l.productId
    const unit = unitPriceOf(items, l.productId, l.variantId)
    const quantity = (merged.get(key)?.quantity ?? 0) + l.quantity
    merged.set(key, {
      productId: l.productId,
      ...(l.variantId ? { variantId: l.variantId } : {}),
      name: l.name,
      quantity,
      unitPrice: unit,
      amount: round2(quantity * unit),
    })
  }
  return [...merged.values()]
}

/**
 * Net rupee amount the database refunds for `targetLines` after accounting for `discountAmount` (promo code)
 * and capping at the order's net item total (never touching delivery or extra fees).
 */
export function netReturnRefund(
  items: OrderItem[],
  targetLines: { productId: string; variantId?: string | null; quantity: number }[],
  opts: {
    discountAmount?: number
    paidAmount?: number
    alreadyRefunded?: number
    priorReturnedLines?: { productId: string; variantId?: string | null; quantity: number }[]
  } = {}
): number {
  const itemsAll = round2(items.reduce((n, i) => n + i.price * i.quantity, 0))
  if (itemsAll <= 0) return 0
  const discount = Math.max(0, opts.discountAmount ?? 0)
  const netItemsMax = Math.max(0, round2(itemsAll - discount))
  const itemsNet = opts.paidAmount !== undefined ? Math.min(netItemsMax, Math.max(0, opts.paidAmount)) : netItemsMax

  const rawValue = round2(
    targetLines.reduce((n, l) => (l.quantity > 0 ? n + l.quantity * unitPriceOf(items, l.productId, l.variantId) : n), 0)
  )
  if (rawValue <= 0) return 0

  const rawPrev = round2(
    (opts.priorReturnedLines ?? []).reduce(
      (n, l) => (l.quantity > 0 ? n + l.quantity * unitPriceOf(items, l.productId, l.variantId) : n),
      0
    )
  )
  const alreadyRef = Math.max(0, opts.alreadyRefunded ?? 0)
  const remainingCap = Math.max(0, round2(itemsNet - alreadyRef))

  if (rawPrev + rawValue >= itemsAll - 0.005) {
    return opts.alreadyRefunded !== undefined ? remainingCap : itemsNet
  }
  const rawPaise = Math.round((rawValue + Number.EPSILON) * 100)
  const netPaise = Math.round((itemsNet + Number.EPSILON) * 100)
  const allPaise = Math.round((itemsAll + Number.EPSILON) * 100)
  const proportional = Number((BigInt(rawPaise) * BigInt(netPaise) + BigInt(Math.floor(allPaise / 2))) / BigInt(allPaise)) / 100
  return opts.alreadyRefunded !== undefined ? Math.min(proportional, remainingCap) : Math.min(proportional, itemsNet)
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
  /** Portion of the order's promo code discount attributed to the returned items (0 when no promo code was used). */
  promoDiscountShare: number
  notRefunded: NotRefunded[]
  notRefundedTotal: number
  /** What the customer gets back for these lines (= itemsTotal - promoDiscountShare). */
  refundable: number
  /** What was paid for the order. */
  paid: number
  /** Money already sent back for this order. */
  alreadyRefunded: number
}

/** The refund picture of an order's return, or null when there is no return activity (or only an exchange). */
export function refundBreakdown(o: {
  items: OrderItem[]
  returnRequests: ReturnRequest[]
  returns: OrderReturn[]
  shippingFee: number
  extraFees: OrderFee[]
  discountAmount?: number
  total: number
  paymentAmount: number | null
  refundedAmount: number
}): RefundBreakdown | null {
  const open = o.returnRequests.find(isOpenRequest)
  const openRefundReq = open && open.resolutionType !== "exchange" ? open : undefined
  const refundableReturns = o.returns.filter((r) => r.refunded || r.resolutionType !== "exchange")
  const returnedItems = refundableReturns.flatMap((r) => r.items)
  const source = openRefundReq ? [...returnedItems, ...openRefundReq.items] : returnedItems
  if (source.length === 0) return null
  const lines = refundLines(o.items, source)
  const itemsTotal = round2(lines.reduce((n, l) => n + l.amount, 0))
  const paid = o.paymentAmount ?? o.total
  const refundable = netReturnRefund(o.items, lines, {
    discountAmount: o.discountAmount ?? 0,
    paidAmount: paid,
  })
  const netWithPromo =
    (o.discountAmount ?? 0) > 0
      ? netReturnRefund(o.items, lines, { discountAmount: o.discountAmount ?? 0 })
      : itemsTotal
  const promoDiscountShare = (o.discountAmount ?? 0) > 0 ? Math.max(0, round2(itemsTotal - netWithPromo)) : 0
  const notRefunded = notRefundedCharges(o)
  return {
    basis: openRefundReq ? "request" : "returned",
    lines,
    itemsTotal,
    promoDiscountShare,
    notRefunded,
    notRefundedTotal: round2(notRefunded.reduce((n, c) => n + c.amount, 0)),
    refundable,
    paid,
    alreadyRefunded: o.refundedAmount,
  }
}

import { describe, expect, it } from "vitest"
import { netReturnRefund, notRefundedCharges, refundBreakdown, refundLines } from "./refund"
import type { OrderItem, ReturnRequest } from "./types"

const items: OrderItem[] = [
  { productId: "a", name: "Candle", slug: "candle", price: 500, quantity: 2, image: null },
  { productId: "b", name: "Basket", slug: "basket", price: 300, quantity: 1, image: null },
]
const request = (status: ReturnRequest["status"], list: ReturnRequest["items"]): ReturnRequest => ({
  id: "r1", items: list, reason: "x", details: null, status, adminNote: null, createdAt: "2026-01-01T00:00:00Z", decidedAt: null, pickupDate: null, pickedUpAt: null,
})
const base = { items, returns: [], shippingFee: 60, extraFees: [{ label: "Gift wrap", amount: 40, productName: "Candle" }], total: 1400, paymentAmount: 1400, refundedAmount: 0 }

describe("refund = items only", () => {
  it("prices lines from the order and merges duplicates", () => {
    expect(refundLines(items, [{ productId: "a", name: "Candle", quantity: 1 }, { productId: "a", name: "Candle", quantity: 1 }])).toEqual([
      { productId: "a", name: "Candle", quantity: 2, unitPrice: 500, amount: 1000 },
    ])
  })

  it("delivery and extra charges are listed as not refunded", () => {
    expect(notRefundedCharges(base)).toEqual([
      { label: "Delivery charge", amount: 60 },
      { label: "Gift wrap (Candle)", amount: 40 },
    ])
    expect(notRefundedCharges({ shippingFee: 0, extraFees: [] })).toEqual([])
  })

  it("an open request shows what the customer gets back: the items, not the total paid", () => {
    const b = refundBreakdown({ ...base, returnRequests: [request("approved", [{ productId: "a", name: "Candle", quantity: 1 }])] })
    expect(b).toMatchObject({ basis: "request", itemsTotal: 500, refundable: 500, notRefundedTotal: 100, paid: 1400 })
  })

  it("after the goods came back it is based on the returns; nothing when there is no return activity", () => {
    const returned = refundBreakdown({
      ...base,
      returnRequests: [request("received", [{ productId: "a", name: "Candle", quantity: 1 }])],
      returns: [{ id: "x", items: [{ productId: "b", name: "Basket", quantity: 1 }], reason: null, refunded: true, createdAt: "2026-01-02T00:00:00Z" }],
      refundedAmount: 300,
    })
    expect(returned).toMatchObject({ basis: "returned", refundable: 300, alreadyRefunded: 300 })
    expect(refundBreakdown({ ...base, returnRequests: [] })).toBeNull()
  })

  it("combines earlier completed returns with a new open return request so totals match alreadyRefunded", () => {
    const combined = refundBreakdown({
      ...base,
      returnRequests: [request("approved", [{ productId: "b", name: "Basket", quantity: 1 }])],
      returns: [{ id: "x", items: [{ productId: "a", name: "Candle", quantity: 1 }], reason: null, refunded: true, createdAt: "2026-01-02T00:00:00Z" }],
      refundedAmount: 500,
    })
    expect(combined).toMatchObject({ basis: "request", itemsTotal: 800, refundable: 800, alreadyRefunded: 500 })
  })

  it("accounts for promo discountAmount proportionally and never refunds delivery/extra fees", () => {
    // items subtotal = 1300 (2x500 + 1x300), discount = 260 (20% off), shipping = 60, extra = 40 -> total = 1140
    const discountedOrder = {
      ...base,
      discountAmount: 260,
      total: 1140,
      paymentAmount: 1140,
    }
    // Returning 1 Candle (raw 500) -> 20% promo share (100) -> refundable = 400
    const partial = refundBreakdown({
      ...discountedOrder,
      returnRequests: [request("approved", [{ productId: "a", name: "Candle", quantity: 1 }])],
    })
    expect(partial).toMatchObject({
      basis: "request",
      itemsTotal: 500,
      promoDiscountShare: 100,
      refundable: 400,
      notRefundedTotal: 100,
      paid: 1140,
    })

    // Returning all items (raw 1300) -> refundable = 1040 (never eating the ₹100 delivery + extra fees)
    const full = refundBreakdown({
      ...discountedOrder,
      returnRequests: [
        request("approved", [
          { productId: "a", name: "Candle", quantity: 2 },
          { productId: "b", name: "Basket", quantity: 1 },
        ]),
      ],
    })
    expect(full).toMatchObject({
      itemsTotal: 1300,
      promoDiscountShare: 260,
      refundable: 1040,
      paid: 1140,
    })
    expect(netReturnRefund(items, [{ productId: "a", quantity: 2 }, { productId: "b", quantity: 1 }], { discountAmount: 260, paidAmount: 1140 })).toBe(1040)
  })

  it("returns null for pure exchange requests and unrefunded exchange returns", () => {
    const exchangeReq: ReturnRequest = {
      ...request("approved", [{ productId: "a", name: "Candle", quantity: 1 }]),
      resolutionType: "exchange",
      exchangePreference: "Terracotta colour",
    }
    expect(refundBreakdown({ ...base, returnRequests: [exchangeReq] })).toBeNull()
    expect(
      refundBreakdown({
        ...base,
        returnRequests: [{ ...exchangeReq, status: "received" }],
        returns: [{ id: "x", items: [{ productId: "a", name: "Candle", quantity: 1 }], reason: null, refunded: false, resolutionType: "exchange", createdAt: "2026-01-02T00:00:00Z" }],
      })
    ).toBeNull()
  })

  it("rounds .xx5 proportional refunds half-up, skips promo share on manual underpayment, and reconciles 3 equal items", () => {
    const oddItems: OrderItem[] = [
      { productId: "a", name: "Item A", slug: "a", price: 71, quantity: 1, image: null },
      { productId: "b", name: "Item B", slug: "b", price: 329, quantity: 1, image: null },
    ]
    expect(netReturnRefund(oddItems, [{ productId: "a", quantity: 1 }], { discountAmount: 10 })).toBe(69.23)

    const underpaid = refundBreakdown({
      items: [{ productId: "a", name: "Candle", slug: "candle", price: 400, quantity: 1, image: null }],
      returns: [],
      returnRequests: [request("approved", [{ productId: "a", name: "Candle", quantity: 1 }])],
      shippingFee: 0,
      extraFees: [],
      discountAmount: 0,
      total: 400,
      paymentAmount: 350,
      refundedAmount: 0,
    })
    expect(underpaid).not.toBeNull()
    expect(underpaid?.promoDiscountShare).toBe(0)
    expect(underpaid?.refundable).toBe(350)

    const threeItems: OrderItem[] = [
      { productId: "a", name: "A", slug: "a", price: 100, quantity: 1, image: null },
      { productId: "b", name: "B", slug: "b", price: 100, quantity: 1, image: null },
      { productId: "c", name: "C", slug: "c", price: 100, quantity: 1, image: null },
    ]
    const r1 = netReturnRefund(threeItems, [{ productId: "a", quantity: 1 }], { discountAmount: 100, alreadyRefunded: 0 })
    const r2 = netReturnRefund(threeItems, [{ productId: "b", quantity: 1 }], {
      discountAmount: 100,
      alreadyRefunded: r1,
      priorReturnedLines: [{ productId: "a", quantity: 1 }],
    })
    const r3 = netReturnRefund(threeItems, [{ productId: "c", quantity: 1 }], {
      discountAmount: 100,
      alreadyRefunded: r1 + r2,
      priorReturnedLines: [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
    })
    expect([r1, r2, r3]).toEqual([66.67, 66.67, 66.66])
    expect(Number((r1 + r2 + r3).toFixed(2))).toBe(200)
  })
})

import { describe, expect, it } from "vitest"
import { notRefundedCharges, refundBreakdown, refundLines } from "./refund"
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
})

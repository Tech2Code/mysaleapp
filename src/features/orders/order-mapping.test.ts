import { describe, expect, it } from "vitest"
import { ORDER_STATUSES, PAYMENT_STATUSES, canVerifyPayment, isAwaitingPayment, mapFees, mapOrder, normalizePricing, type OrderRow } from "./types"

const row: OrderRow = {
  id: "id",
  order_code: "KK-ABC123",
  user_id: null,
  customer_name: "AUDIT TEST",
  phone: "9876543210",
  address: "addr",
  city: "Mumbai, Maharashtra",
  pincode: "400001",
  note: null,
  items: [{ productId: "p", name: "Lamp", slug: "lamp", price: "99.50" as unknown as number, quantity: 2, image: null }],
  subtotal: "199",
  status: "pending",
  shipping_carrier: null,
  tracking_number: null,
  tracking_url: null,
  expected_delivery: null,
  shipping_fee: "50",
  shipping_fee_original: "80",
  extra_fees: [{ label: "Handling", amount: "20", productId: "p", productName: "Lamp", reason: "fragile" }],
  total: "269",
  payment_status: "paid",
  payment_method: "upi",
  payment_reference: "123456789012",
  payment_amount: "269",
  payment_submitted_at: null,
  payment_paid_at: null,
  payment_note: null,
  delivery_updated_at: null,
  cancel_reason: null,
  cancelled_by: null,
  cancelled_at: null,
  refund_reference: null,
  refunded_at: null,
  refunded_amount: "69",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("normalizePricing (also used by mapOrder via mapPricing)", () => {
  it("turns numeric strings into numbers", () => {
    const p = mapOrder(row)
    expect(p).toMatchObject({ subtotal: 199, shippingFee: 50, shippingFeeOriginal: 80, total: 269, paymentAmount: 269, refundedAmount: 69 })
    expect(p.items[0].price).toBe(99.5)
  })

  it("defaults nulls: total falls back to subtotal, fees to 0, payment to pending/null", () => {
    expect(normalizePricing({ subtotal: "100" })).toEqual({
      subtotal: 100,
      shippingFee: 0,
      shippingFeeOriginal: 0,
      extraFees: [],
      total: 100,
      paymentStatus: "pending",
      paymentMethod: null,
      paymentReference: null,
      paymentAmount: null,
      paymentSubmittedAt: null,
      paymentPaidAt: null,
      paymentNote: null,
      refundedAmount: 0,
    })
  })

  it("keeps a recorded payment amount of 0 (not null)", () => {
    expect(normalizePricing({ subtotal: 1, paymentAmount: 0 }).paymentAmount).toBe(0)
    expect(normalizePricing({ subtotal: 1, paymentAmount: null }).paymentAmount).toBeNull()
  })

  it("mapFees keeps the product and reason only when present", () => {
    expect(mapOrder(row).extraFees).toEqual([{ label: "Handling", amount: 20, productId: "p", productName: "Lamp", reason: "fragile" }])
    expect(mapFees([{ label: "Gift wrap", amount: "10", reason: null }])).toEqual([{ label: "Gift wrap", amount: 10 }])
    expect(mapFees(null)).toEqual([])
  })
})

describe("mapOrder", () => {
  it("only a cancelled order carries a cancellation", () => {
    expect(mapOrder(row).cancellation).toBeNull()
    expect(mapOrder({ ...row, status: "cancelled", cancelled_by: "system", cancel_reason: "expired" }).cancellation).toMatchObject({ by: "system", reason: "expired" })
  })
  it("shipping appears only with a carrier; the private note can be an object or an array", () => {
    expect(mapOrder(row).shipping).toBeNull()
    expect(mapOrder({ ...row, shipping_carrier: "DTDC" }).shipping).toMatchObject({ carrier: "DTDC", trackingNumber: null })
    expect(mapOrder({ ...row, private_note: [{ note: "a" }] }).adminNote).toBe("a")
    expect(mapOrder({ ...row, private_note: { note: "b" } }).adminNote).toBe("b")
    expect(mapOrder(row).adminNote).toBeNull()
  })
  it("maps tax_snapshot when present and leaves it null on older orders", () => {
    expect(mapOrder(row).taxSnapshot).toBeNull()
    const snapped = mapOrder({
      ...row,
      tax_snapshot: {
        gstRegistered: true,
        gstin: "27AAAAA0000A1Z5",
        gstRate: "12",
        legalName: "Kalakriti Studio",
        businessAddress: "Mumbai",
        shopName: "Kalakriti",
        city: "Mumbai",
        region: "Maharashtra",
        phone: null,
        whatsappNumber: "919876543210",
        email: "hi@example.com",
      },
    })
    expect(snapped.taxSnapshot).toEqual({
      gstRegistered: true,
      gstin: "27AAAAA0000A1Z5",
      gstRate: 12,
      legalName: "Kalakriti Studio",
      businessAddress: "Mumbai",
      shopName: "Kalakriti",
      city: "Mumbai",
      region: "Maharashtra",
      phone: "+91 98765 43210",
      whatsappNumber: "919876543210",
      email: "hi@example.com",
    })
  })
})

describe("isAwaitingPayment / canVerifyPayment (all status combinations)", () => {
  for (const status of ORDER_STATUSES) {
    for (const paymentStatus of PAYMENT_STATUSES) {
      const o = { status, paymentStatus }
      it(`${status} + ${paymentStatus}`, () => {
        expect(isAwaitingPayment(o)).toBe(status === "pending" && (paymentStatus === "pending" || paymentStatus === "failed"))
        expect(canVerifyPayment(o)).toBe(status !== "cancelled" && paymentStatus !== "paid" && paymentStatus !== "refunded")
      })
    }
  }

  it("a cancelled order is never awaiting payment", () => {
    for (const p of PAYMENT_STATUSES) expect(isAwaitingPayment({ status: "cancelled", paymentStatus: p })).toBe(false)
  })
})

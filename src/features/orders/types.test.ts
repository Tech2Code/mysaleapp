import { describe, expect, it } from "vitest"
import { canVerifyPayment, composeOrderCode, ORDER_STATUSES, PAYMENT_STATUSES, paymentDisplay, stripOrderPrefix } from "./types"

describe("paymentDisplay", () => {
  it("a cancelled order never says awaiting/pending payment", () => {
    for (const p of PAYMENT_STATUSES) {
      const { label } = paymentDisplay("cancelled", p, null)
      expect(label).not.toMatch(/awaiting|payment pending/i)
    }
    expect(paymentDisplay("cancelled", "pending", null)).toEqual({ label: "No payment due", tone: "cancelled" })
    expect(paymentDisplay("cancelled", "paid", "upi").tone).toBe("refund_due")
    expect(paymentDisplay("cancelled", "refunded", null).tone).toBe("refunded")
  })
  it("shows partial refunds only while paid", () => {
    expect(paymentDisplay("delivered", "paid", "upi", { refundedAmount: 100, paidAmount: 500 }).tone).toBe("refunded")
    expect(paymentDisplay("delivered", "paid", "upi", { refundedAmount: 0, paidAmount: 500 }).label).toBe("Paid via UPI")
  })
  it("keeps the payment tone for live orders", () => {
    for (const o of ORDER_STATUSES.filter((o) => o !== "cancelled")) expect(paymentDisplay(o, "pending", null).tone).toBe("pending")
  })
})

describe("canVerifyPayment", () => {
  it("allows verifying a submitted UTR even when the order was cancelled", () => {
    expect(canVerifyPayment({ status: "cancelled", paymentStatus: "submitted" })).toBe(true)
    expect(canVerifyPayment({ status: "cancelled", paymentStatus: "pending" })).toBe(false)
    expect(canVerifyPayment({ status: "cancelled", paymentStatus: "failed" })).toBe(false)
    expect(canVerifyPayment({ status: "pending", paymentStatus: "submitted" })).toBe(true)
  })
})

describe("order code prefix helpers", () => {
  it("strips the store prefix for suffix-only copy & input while preserving other prefixes", () => {
    expect(stripOrderPrefix("KK-7F3K9Q", "KK")).toBe("7F3K9Q")
    expect(stripOrderPrefix(" kk-7f3k9q ", "kk")).toBe("7F3K9Q")
    expect(stripOrderPrefix("7F3K9Q", "KK")).toBe("7F3K9Q")
    expect(stripOrderPrefix("OLD-123456", "KK")).toBe("OLD-123456")
  })

  it("composes full order codes from suffix or keeps legacy prefixed codes intact", () => {
    expect(composeOrderCode("7F3K9Q", "KK")).toBe("KK-7F3K9Q")
    expect(composeOrderCode("7f3k9q", "kk-")).toBe("KK-7F3K9Q")
    expect(composeOrderCode("OLD-123456", "KK")).toBe("OLD-123456")
    expect(composeOrderCode("", "KK")).toBe("")
  })
})

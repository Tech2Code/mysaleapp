import { describe, expect, it } from "vitest"
import { ORDER_STATUSES, PAYMENT_STATUSES, paymentDisplay } from "./types"

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

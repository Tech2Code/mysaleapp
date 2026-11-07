import { describe, expect, it } from "vitest"
import { paymentDue } from "./payment-due"

const base = { status: "confirmed", paymentStatus: "paid", total: 369, paymentAmount: 369, refundedAmount: 0 } as const

describe("paymentDue", () => {
  it("hides when paid in full", () => expect(paymentDue(base)).toBeNull())
  it("shows the shortfall when paid short", () =>
    expect(paymentDue({ ...base, paymentAmount: 300 })).toEqual({ label: "Still to collect", amount: 69 }))
  it("shows total while unpaid or submitted", () => {
    expect(paymentDue({ ...base, status: "pending", paymentStatus: "pending", paymentAmount: null })).toEqual({ label: "To collect", amount: 369 })
    expect(paymentDue({ ...base, paymentStatus: "submitted", paymentAmount: null })?.label).toBe("To collect")
  })
  it("shows refunded amount for partial and full refunds", () => {
    expect(paymentDue({ ...base, refundedAmount: 100 })).toEqual({ label: "Refunded so far", amount: 100 })
    expect(paymentDue({ ...base, paymentStatus: "refunded", refundedAmount: 369 })).toEqual({ label: "Refunded", amount: 369 })
  })
  it("shows nothing for a cancelled unpaid or paid order", () => {
    expect(paymentDue({ ...base, status: "cancelled", paymentStatus: "pending", paymentAmount: null })).toBeNull()
    expect(paymentDue({ ...base, status: "cancelled" })).toBeNull()
  })
})

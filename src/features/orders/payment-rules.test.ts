import { describe, expect, it } from "vitest"
import { allowedPaymentStatuses, isPaymentMoneyLocked, paymentEditNote, paymentUpdateProblem } from "./payment-rules"
import { ORDER_STATUSES, PAYMENT_STATUSES } from "./types"

const cur = (o: Partial<Parameters<typeof paymentUpdateProblem>[0]> = {}) => ({
  status: "delivered" as const, paymentStatus: "paid" as const, paymentAmount: 500, paymentReference: "UTR1", ...o,
})

describe("allowedPaymentStatuses", () => {
  it("paid can only stay paid or be refunded; refunded is terminal", () => {
    for (const status of ORDER_STATUSES) {
      expect(allowedPaymentStatuses({ status, paymentStatus: "paid" })).toEqual(["paid", "refunded"])
      expect(allowedPaymentStatuses({ status, paymentStatus: "refunded" })).toEqual(["refunded"])
    }
  })
  it("unpaid orders can move freely, but never to refunded", () => {
    for (const p of ["pending", "submitted", "failed"] as const) {
      expect(allowedPaymentStatuses({ status: "confirmed", paymentStatus: p })).toEqual(["pending", "submitted", "paid", "failed"])
    }
  })
  it("a cancelled unpaid order can't become paid or submitted by hand", () => {
    expect(allowedPaymentStatuses({ status: "cancelled", paymentStatus: "pending" })).toEqual(["pending", "failed"])
    expect(allowedPaymentStatuses({ status: "cancelled", paymentStatus: "submitted" })).toEqual(["pending", "submitted", "failed"])
  })
  it("only offers known statuses", () => {
    for (const s of allowedPaymentStatuses({ status: "pending", paymentStatus: "pending" })) expect(PAYMENT_STATUSES).toContain(s)
  })
})

describe("paymentUpdateProblem", () => {
  it("refuses paid -> unpaid and refunded -> anything else on every order status", () => {
    for (const status of ORDER_STATUSES) {
      for (const next of ["pending", "submitted", "failed"] as const) {
        expect(paymentUpdateProblem(cur({ status }), { status: next, amount: null, reference: null })).toMatch(/refund/i)
      }
      expect(paymentUpdateProblem(cur({ status, paymentStatus: "refunded" }), { status: "paid", amount: null, reference: null })).toMatch(/refunded/i)
    }
  })
  it("allows paid -> refunded", () => {
    expect(paymentUpdateProblem(cur(), { status: "refunded", amount: 100, reference: "R1" })).toBeNull()
  })
  it("locks amount and reference of a paid, finished order but not its note-only re-save", () => {
    expect(paymentUpdateProblem(cur(), { status: "paid", amount: 400, reference: "UTR1" })).toMatch(/amount/i)
    expect(paymentUpdateProblem(cur(), { status: "paid", amount: 500, reference: "OTHER" })).toMatch(/reference/i)
    expect(paymentUpdateProblem(cur(), { status: "paid", amount: null, reference: "UTR1" })).toBeNull()
    expect(paymentUpdateProblem(cur(), { status: "paid", amount: 500, reference: "UTR1" })).toBeNull()
  })
  it("a paid order that is still in progress may have its amount corrected", () => {
    expect(paymentUpdateProblem(cur({ status: "confirmed" }), { status: "paid", amount: 400, reference: "UTR1" })).toBeNull()
  })
  it("cancelled unpaid order: no paid/submitted", () => {
    expect(paymentUpdateProblem(cur({ status: "cancelled", paymentStatus: "submitted" }), { status: "paid", amount: null, reference: null })).toMatch(/cancelled/i)
  })
})

describe("helpers", () => {
  it("money lock only for finished + paid/refunded", () => {
    expect(isPaymentMoneyLocked({ status: "delivered", paymentStatus: "paid" })).toBe(true)
    expect(isPaymentMoneyLocked({ status: "confirmed", paymentStatus: "paid" })).toBe(false)
    expect(isPaymentMoneyLocked({ status: "delivered", paymentStatus: "pending" })).toBe(false)
  })
  it("has a note whenever an option is withheld", () => {
    expect(paymentEditNote({ status: "delivered", paymentStatus: "paid" })).toMatch(/locked/)
    expect(paymentEditNote({ status: "confirmed", paymentStatus: "paid" })).toMatch(/refunded/)
    expect(paymentEditNote({ status: "confirmed", paymentStatus: "pending" })).toBeNull()
  })
})

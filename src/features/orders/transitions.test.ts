import { describe, expect, it } from "vitest"
import { checkTransition, NEXT_STATUSES, statusChoices } from "./transitions"
import { ORDER_STATUSES, PAYMENT_STATUSES } from "./types"

describe("checkTransition matrix", () => {
  for (const from of ORDER_STATUSES)
    for (const to of ORDER_STATUSES)
      for (const payment of PAYMENT_STATUSES)
        for (const hasCourier of [true, false]) {
          it(`${from} -> ${to} (payment ${payment}, courier ${hasCourier})`, () => {
            const r = checkTransition({ from, to, payment, hasCourier })
            if (from === to) return expect(r).toBeNull()
            if (to === "cancelled") return expect(r).not.toBeNull()
            if (!NEXT_STATUSES[from].includes(to)) return expect(r).not.toBeNull()
            if (payment !== "paid") return expect(r).toMatch(/[Pp]ayment/)
            if (to === "shipped" && !hasCourier) return expect(r).toMatch(/courier/)
            expect(r).toBeNull()
          })
        }
})

describe("rules", () => {
  it("never offers cancelled in the dropdown", () => {
    for (const s of ORDER_STATUSES) expect(statusChoices(s).filter((x) => x !== s)).not.toContain("cancelled")
  })
  it("lists current status first", () => {
    expect(statusChoices("confirmed")).toEqual(["confirmed", "packed", "shipped", "pending"])
    expect(statusChoices("delivered")).toEqual(["delivered"])
  })
  it("terminal states can't move", () => {
    expect(checkTransition({ from: "cancelled", to: "pending", payment: "paid", hasCourier: true })).toMatch(/can't be changed/)
    expect(checkTransition({ from: "delivered", to: "shipped", payment: "paid", hasCourier: true })).toMatch(/can't be changed/)
  })
  it("pending -> confirmed needs paid", () => {
    expect(checkTransition({ from: "pending", to: "confirmed", payment: "submitted", hasCourier: false })).not.toBeNull()
    expect(checkTransition({ from: "pending", to: "confirmed", payment: "paid", hasCourier: false })).toBeNull()
  })
  it("a refunded payment stops a confirmed order from going forward", () => {
    expect(checkTransition({ from: "confirmed", to: "packed", payment: "refunded", hasCourier: false })).toMatch(/refunded/)
  })
  it("pending can't skip to shipped", () => {
    expect(checkTransition({ from: "pending", to: "shipped", payment: "paid", hasCourier: true })).not.toBeNull()
  })
})

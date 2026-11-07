import { describe, expect, it } from "vitest"
import {
  canRequestAgain,
  customerStatusLine,
  REJECTED_BADGE_DAYS,
  requestStatusMeta,
  returnRefundSummary,
  returnStage,
  returnTimeline,
  type ReturnStageInput,
} from "./returns"
import { RETURN_REQUEST_STATUSES } from "./types"

const base: ReturnStageInput = { requests: [], returns: [], paymentStatus: "paid", refundedAmount: 0, paidAmount: 1000 }
const DAY = 86_400_000
const decided = "2026-03-01T00:00:00Z"
const rejected = (adminNote: string | null = "Used item") => ({ ...base, requests: [{ status: "rejected" as const, createdAt: "2026-02-27T00:00:00Z", decidedAt: decided, adminNote }] })

describe("rejected badge expiry (lists)", () => {
  it("shows for REJECTED_BADGE_DAYS after the decision, then goes quiet but the stage stays", () => {
    const at = (days: number) => new Date(Date.parse(decided) + days * DAY)
    expect(returnStage({ ...rejected(), now: at(REJECTED_BADGE_DAYS - 0.1) })).toMatchObject({ key: "rejected", badge: true })
    const late = returnStage({ ...rejected(), now: at(REJECTED_BADGE_DAYS + 0.1) })!
    expect(late).toMatchObject({ key: "rejected", badge: false, active: false })
    expect(late.customerDetail).toBe("Reason: Used item")
    expect(returnTimeline({ ...rejected(), now: at(30) }).map((e) => e.key)).toEqual(["requested", "rejected"])
  })
  it("without a clock it always shows (detail pages)", () => {
    expect(returnStage(rejected())?.badge).toBe(true)
  })
  it("a newer request replaces the stale rejection", () => {
    const s = returnStage({ ...rejected(), requests: [...rejected().requests, { status: "requested", createdAt: "2026-03-20T00:00:00Z" }], now: new Date("2026-04-01") })
    expect(s?.key).toBe("requested")
  })
})

describe("one wording per state", () => {
  it("request statuses use the stage copy, admin and customer", () => {
    for (const status of RETURN_REQUEST_STATUSES) {
      expect(requestStatusMeta(status, "admin").label).toBeTruthy()
      expect(requestStatusMeta(status, "customer").tone).toBe(requestStatusMeta(status, "admin").tone)
    }
    expect(requestStatusMeta("rejected", "admin").label).toBe("Return rejected")
    expect(requestStatusMeta("rejected", "customer").label).toBe("Return not approved")
    const stage = returnStage({ ...base, requests: [{ status: "approved", createdAt: "2026-01-01T00:00:00Z" }] })!
    expect(requestStatusMeta("approved", "customer").label).toBe(stage.customerLabel)
  })
  it("received tells the admin what to do next", () => {
    const s = returnStage({ ...base, returns: [{ refunded: false, createdAt: "2026-01-02T00:00:00Z" }] })!
    expect(s.detail).toMatch(/no refund recorded/i)
    expect(s.detail).toMatch(/refund/i)
    expect(s.customerDetail).toBe("We have your items. Your refund will follow")
  })
})

describe("customerStatusLine", () => {
  const stage = (status: "requested" | "approved") => returnStage({ ...base, requests: [{ status, createdAt: "2026-01-01T00:00:00Z" }] })
  it("falls back to the order description without a stage", () => {
    expect(customerStatusLine("Delivered — enjoy!", null)).toBe("Delivered — enjoy!")
  })
  it("talks about the return and never says 'enjoy' or an amount", () => {
    const lines = [
      customerStatusLine("Delivered — enjoy!", stage("requested")),
      customerStatusLine("Delivered — enjoy!", stage("approved")),
      customerStatusLine("Delivered — enjoy!", returnStage({ ...base, returns: [{ refunded: false, createdAt: "2026-01-02T00:00:00Z" }] })),
      customerStatusLine("Delivered — enjoy!", returnStage({ ...base, paymentStatus: "refunded", refundedAmount: 1000, returns: [{ refunded: true, createdAt: "2026-01-02T00:00:00Z" }] })),
    ]
    for (const l of lines) {
      expect(l).not.toMatch(/enjoy|₹|\d/)
    }
    expect(lines[0]).toBe("Your return is being reviewed.")
    expect(lines[1]).toMatch(/send the items back/i)
  })
  it("a rejection says whether a new request is possible", () => {
    const s = returnStage(rejected())
    expect(customerStatusLine("x", s, { canRequestAgain: true })).toBe("Reason: Used item. You can send a new request.")
    expect(customerStatusLine("x", s, { canRequestAgain: false })).toBe("Reason: Used item. The return window has ended.")
    expect(customerStatusLine("x", s)).toBe("Reason: Used item.")
  })
  it("a withdrawn request is just history", () => {
    expect(customerStatusLine("Delivered — enjoy!", returnStage({ ...base, requests: [{ status: "withdrawn", createdAt: "2026-01-01T00:00:00Z" }] }))).toBe("Delivered — enjoy!")
  })
})

describe("canRequestAgain", () => {
  it("needs an open window and no open request", () => {
    expect(canRequestAgain([{ status: "rejected" }], true)).toBe(true)
    expect(canRequestAgain([{ status: "withdrawn" }, { status: "received" }], true)).toBe(true)
    expect(canRequestAgain([{ status: "rejected" }, { status: "requested" }], true)).toBe(false)
    expect(canRequestAgain([{ status: "approved" }], true)).toBe(false)
    expect(canRequestAgain([{ status: "rejected" }], false)).toBe(false)
  })
})

describe("per-return refund state (admin)", () => {
  const r = (refunded: boolean, createdAt: string, refundAmount: number | null = null) => ({ refunded, createdAt, refundAmount })
  it("says 'No refund recorded' for a return without a refund, even after a refunded one", () => {
    expect(returnRefundSummary([])).toBeNull()
    expect(returnRefundSummary([r(false, "2026-01-02T00:00:00Z")])).toBe("No refund recorded")
    const two = returnRefundSummary([r(false, "2026-01-05T00:00:00Z"), r(true, "2026-01-02T00:00:00Z", 300)])
    expect(two).toBe("Return 1: Refunded ₹300 · Return 2: No refund recorded")
  })
  it("is in the admin timeline entry only, never guest data", () => {
    const input = { ...base, requests: [{ status: "received" as const, createdAt: "2026-01-01T00:00:00Z" }], returns: [r(false, "2026-01-02T00:00:00Z")] }
    expect(returnTimeline(input).find((e) => e.key === "received")?.adminDetail).toBe("No refund recorded")
    expect(returnTimeline(input).find((e) => e.key === "requested")?.adminDetail).toBeUndefined()
  })
})

import { describe, expect, it } from "vitest"
import { returnStage, returnTimeline, stageDetail, stageLabel, type ReturnStageInput } from "./returns"

const base: ReturnStageInput = { requests: [], returns: [], paymentStatus: "paid", refundedAmount: 0, paidAmount: 1000 }
const req = (status: ReturnStageInput["requests"][number]["status"], createdAt = "2026-01-01T10:00:00Z", extra = {}) => ({ status, createdAt, ...extra })
const ret = (refunded = false, createdAt = "2026-01-05T10:00:00Z") => ({ refunded, createdAt })

describe("returnStage", () => {
  it("is null when nothing happened (a plain refund is the payment badge's business)", () => {
    expect(returnStage(base)).toBeNull()
    expect(returnStage({ ...base, paymentStatus: "refunded", refundedAmount: 1000 })).toBeNull()
  })

  it("walks requested -> approved", () => {
    expect(returnStage({ ...base, requests: [req("requested")] })).toMatchObject({ key: "requested", step: 1, tone: "info", active: true })
    expect(returnStage({ ...base, requests: [req("approved")] })).toMatchObject({ key: "approved", step: 2, active: true })
  })

  it("rejected carries the reason, withdrawn is quiet in lists", () => {
    const rejected = returnStage({ ...base, requests: [req("rejected", undefined, { adminNote: " Used item " })] })!
    expect(rejected).toMatchObject({ key: "rejected", tone: "danger", active: false, label: "Return rejected", customerLabel: "Return not approved" })
    expect(rejected.customerDetail).toBe("Reason: Used item")
    expect(returnStage({ ...base, requests: [req("withdrawn")] })).toMatchObject({ key: "withdrawn", badge: false, active: false })
  })

  it("received, then partly refunded, then refunded", () => {
    const received = { ...base, requests: [req("received")], returns: [ret()] }
    expect(returnStage(received)).toMatchObject({ key: "received", step: 3 })
    expect(returnStage({ ...received, refundedAmount: 250 })).toMatchObject({ key: "partly_refunded", step: 4 })
    expect(returnStage({ ...received, paymentStatus: "refunded", refundedAmount: 1000 })).toMatchObject({ key: "refunded", step: 4, active: false })
  })

  it("goods recorded without any request still have a stage", () => {
    expect(returnStage({ ...base, returns: [ret()] })).toMatchObject({ key: "received" })
  })

  it("guests (refundedAmount always 0) still see 'partly refunded' from the return rows", () => {
    expect(returnStage({ ...base, returns: [ret(true)], refundedAmount: 0 })).toMatchObject({ key: "partly_refunded" })
  })

  it("an open request beats an earlier completed return; the newest request wins", () => {
    const s = returnStage({
      ...base,
      requests: [req("received", "2026-01-01T00:00:00Z"), req("requested", "2026-01-20T00:00:00Z")],
      returns: [ret(true)],
    })
    expect(s?.key).toBe("requested")
    // string order would pick "…Z" over "…+00:00"; instants must decide
    expect(returnStage({ ...base, requests: [req("rejected", "2026-02-01T00:00:00+00:00"), req("withdrawn", "2026-01-31T23:59:59Z")] })?.key).toBe("rejected")
  })

  it("customer wording never contains an amount; admin wording may", () => {
    const s = returnStage({ ...base, requests: [req("received")], returns: [ret(true)], refundedAmount: 250 })!
    expect(s.detail).toContain("₹")
    for (const stage of ["requested", "approved", "received"] as const) {
      const x = returnStage({ ...base, requests: [req(stage)], returns: stage === "received" ? [ret()] : [] })!
      expect(x.customerDetail).not.toMatch(/₹|\d/)
    }
    expect(s.customerDetail).not.toMatch(/₹|\d/)
    expect(stageLabel(s, "customer")).toBe("Partially refunded")
    expect(stageLabel(s, "admin")).toBe("Return part-refunded")
    expect(stageDetail(s, "customer")).toBe(s.customerDetail)
  })
})

describe("returnTimeline", () => {
  const keys = (i: ReturnStageInput) => returnTimeline(i).map((e) => `${e.key}:${e.state}`)

  it("is empty without return activity", () => expect(returnTimeline(base)).toEqual([]))

  it("requested: approval is the current step, the rest upcoming", () => {
    expect(keys({ ...base, requests: [req("requested")] })).toEqual(["requested:done", "approved:current", "received:upcoming", "refund:upcoming"])
  })

  it("approved shows the pickup note", () => {
    const t = returnTimeline({ ...base, requests: [req("approved", undefined, { decidedAt: "2026-01-02T00:00:00Z", adminNote: "Courier will call" })] })
    expect(t.find((e) => e.key === "approved")).toMatchObject({ state: "current", note: "Courier will call", at: "2026-01-02T00:00:00Z" })
  })

  it("rejected / withdrawn stop the line", () => {
    expect(keys({ ...base, requests: [req("rejected")] })).toEqual(["requested:done", "rejected:stopped"])
    expect(keys({ ...base, requests: [req("withdrawn")] })).toEqual(["requested:done", "withdrawn:stopped"])
  })

  it("completed return: received done, refund follows the payment", () => {
    const received = { ...base, requests: [req("received")], returns: [ret()] }
    expect(keys(received)).toEqual(["requested:done", "approved:done", "received:done", "refund:upcoming"])
    expect(keys({ ...received, refundedAmount: 1 })).toContain("refund:current")
    expect(keys({ ...received, paymentStatus: "refunded" })).toContain("refund:done")
  })

  it("direct admin return has no request/approval steps", () => {
    expect(keys({ ...base, returns: [ret()] })).toEqual(["received:done", "refund:upcoming"])
  })

  it("never leaks amounts", () => {
    const t = returnTimeline({ ...base, requests: [req("received")], returns: [ret(true)], refundedAmount: 250 })
    expect(JSON.stringify(t)).not.toContain("₹")
  })
})

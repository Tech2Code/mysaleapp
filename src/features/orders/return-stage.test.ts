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
    expect(returnStage({ ...base, returns: [ret(true)], refundedAmount: 0 })).toMatchObject({ key: "partly_refunded", active: false })
  })

  it("clears active and marks timeline refund done when all return rows on a partial return are refunded, keeping active while another row is pending", () => {
    expect(returnStage({ ...base, returns: [ret(true)], refundedAmount: 250 })).toMatchObject({ key: "partly_refunded", active: false })
    expect(returnStage({ ...base, returns: [ret(true), ret(false)], refundedAmount: 250 })).toMatchObject({
      key: "partly_refunded",
      active: true,
    })
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
    // a newer rejected request after an earlier partial return surfaces the latest rejection
    expect(
      returnStage({
        ...base,
        requests: [req("received", "2026-01-01T00:00:00Z"), req("rejected", "2026-01-20T00:00:00Z", { decidedAt: "2026-01-21T00:00:00Z", adminNote: "Outside window" })],
        returns: [ret(false, "2026-01-05T10:00:00Z")],
      })?.key
    ).toBe("rejected")
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

  it("handles exchange & replacement lifecycle: active until replacement/exchanged item is delivered", () => {
    const exReq = (status: ReturnStageInput["requests"][number]["status"], extra = {}) =>
      req(status, "2026-01-01T10:00:00Z", { resolutionType: "exchange" as const, exchangePreference: "Exchange: Size M", ...extra })

    expect(returnStage({ ...base, requests: [exReq("requested")] })).toMatchObject({
      key: "requested",
      label: "Exchange requested",
      customerLabel: "Exchange requested",
      active: true,
    })
    expect(returnStage({ ...base, requests: [exReq("approved")] })).toMatchObject({
      key: "approved",
      label: "Exchange approved",
      customerLabel: "Exchange approved",
      active: true,
    })
    // Old item received is only the halfway mark — still active until outbound item is dispatched & delivered
    const exReceived = returnStage({
      ...base,
      requests: [exReq("received")],
      returns: [{ refunded: false, createdAt: "2026-01-05T10:00:00Z", resolutionType: "exchange" }],
    })
    expect(exReceived).toMatchObject({
      key: "received",
      step: 3,
      label: "Returned item received",
      customerLabel: "Returned item received",
      active: true,
    })
    const exDispatched = returnStage({
      ...base,
      requests: [exReq("received", { exchangeStatus: "dispatched", exchangeShippedAt: "2026-01-06T10:00:00Z", exchangeTracking: "AWB123" })],
      returns: [{ refunded: false, createdAt: "2026-01-05T10:00:00Z", resolutionType: "exchange" }],
    })
    expect(exDispatched).toMatchObject({
      key: "exchange_dispatched",
      step: 3,
      label: "Exchange dispatched",
      customerLabel: "Exchange item on the way",
      active: true,
    })
    const exCompleted = returnStage({
      ...base,
      requests: [exReq("received", { exchangeStatus: "delivered", exchangeShippedAt: "2026-01-06T10:00:00Z", exchangeDeliveredAt: "2026-01-08T10:00:00Z" })],
      returns: [{ refunded: false, createdAt: "2026-01-05T10:00:00Z", resolutionType: "exchange" }],
    })
    expect(exCompleted).toMatchObject({
      key: "exchange_completed",
      step: 4,
      label: "Exchange complete",
      customerLabel: "Exchange complete",
      active: false,
    })
    const timeline = returnTimeline({
      ...base,
      requests: [
        exReq("received", {
          exchangeStatus: "delivered",
          exchangeShippedAt: "2026-01-06T10:00:00Z",
          exchangeDeliveredAt: "2026-01-08T10:00:00Z",
          exchangeShipping: {
            carrier: "Delhivery",
            trackingNumber: "AWB12345678",
            trackingUrl: "https://www.delhivery.com/track/package/AWB12345678",
            expectedDelivery: "2026-01-08",
          },
        }),
      ],
      returns: [{ refunded: false, createdAt: "2026-01-05T10:00:00Z", resolutionType: "exchange" }],
    })
    expect(timeline.at(-2)).toMatchObject({
      key: "exchange_dispatched",
      state: "done",
      note: null,
      shipping: { carrier: "Delhivery", trackingNumber: "AWB12345678" },
    })
    expect(timeline.at(-1)).toMatchObject({ key: "exchange_completed", label: "Exchange complete", state: "done" })

    // Same-item Replacement labels
    const repReq = (status: ReturnStageInput["requests"][number]["status"], extra = {}) =>
      req(status, "2026-01-01T10:00:00Z", {
        resolutionType: "exchange" as const,
        exchangePreference: "Replacement: Same item, same size & colour",
        ...extra,
      })
    expect(returnStage({ ...base, requests: [repReq("requested")] })).toMatchObject({
      key: "requested",
      label: "Replacement requested",
      customerLabel: "Replacement requested",
      active: true,
    })
    expect(
      returnStage({
        ...base,
        requests: [repReq("received", { exchangeStatus: "delivered", exchangeDeliveredAt: "2026-01-08T10:00:00Z" })],
        returns: [{ refunded: false, createdAt: "2026-01-05T10:00:00Z", resolutionType: "exchange" }],
      })
    ).toMatchObject({
      key: "exchange_completed",
      label: "Replacement delivered",
      customerLabel: "Replacement delivered",
      active: false,
    })
  })

  it("handles doorstep exchange mode: skips separate pickup/warehouse steps and completes in 1 visit", () => {
    const doorstepApproved = returnStage({
      ...base,
      requests: [
        req("approved", "2026-01-01T10:00:00Z", {
          resolutionType: "exchange" as const,
          exchangePreference: "Replacement: Same item, same size & colour",
          exchangeMode: "doorstep" as const,
          pickupDate: "2026-01-05",
        }),
      ],
    })
    expect(doorstepApproved).toMatchObject({
      key: "approved",
      label: "Doorstep replacement",
      customerLabel: "Doorstep replacement",
      active: true,
    })
    expect(doorstepApproved?.customerDetail).toContain("deliver the new item and collect the old item together")

    const tApproved = returnTimeline({
      ...base,
      requests: [
        req("approved", "2026-01-01T10:00:00Z", {
          resolutionType: "exchange" as const,
          exchangePreference: "Exchange: Size L",
          exchangeMode: "doorstep" as const,
          pickupDate: "2026-01-05",
          exchangeShipping: {
            carrier: "Blue Dart",
            trackingNumber: "BD998877",
            trackingUrl: "https://bluedart.com/track/BD998877",
            expectedDelivery: "2026-01-05",
          },
        }),
      ],
    })
    expect(tApproved.map((e) => `${e.key}:${e.state}`)).toEqual([
      "requested:done",
      "approved:done",
      "pickup:current",
      "exchange_completed:upcoming",
    ])
    expect(tApproved.find((e) => e.key === "pickup")?.shipping).toMatchObject({ carrier: "Blue Dart", trackingNumber: "BD998877" })

    const tDone = returnTimeline({
      ...base,
      requests: [
        req("received", "2026-01-01T10:00:00Z", {
          resolutionType: "exchange" as const,
          exchangePreference: "Exchange: Size L",
          exchangeMode: "doorstep" as const,
          pickupDate: "2026-01-05",
          exchangeStatus: "delivered" as const,
          exchangeDeliveredAt: "2026-01-05T14:00:00Z",
        }),
      ],
      returns: [{ refunded: false, createdAt: "2026-01-05T14:00:00Z", resolutionType: "exchange" }],
    })
    expect(tDone.map((e) => `${e.key}:${e.state}`)).toEqual([
      "requested:done",
      "approved:done",
      "pickup:done",
      "exchange_completed:done",
    ])
  })
})

describe("returnTimeline", () => {
  const keys = (i: ReturnStageInput) => returnTimeline(i).map((e) => `${e.key}:${e.state}`)

  it("is empty without return activity", () => expect(returnTimeline(base)).toEqual([]))

  it("requested: approval is the current step, the rest upcoming", () => {
    expect(keys({ ...base, requests: [req("requested")] })).toEqual(["requested:done", "approved:current", "pickup:upcoming", "picked_up:upcoming", "received:upcoming", "refund:upcoming"])
  })

  it("approved shows the pickup note", () => {
    const t = returnTimeline({ ...base, requests: [req("approved", undefined, { decidedAt: "2026-01-02T00:00:00Z", adminNote: "Courier will call" })] })
    expect(t.find((e) => e.key === "approved")).toMatchObject({ state: "done", note: "Courier will call", at: "2026-01-02T00:00:00Z" })
  })

  it("approved: pickup scheduled is current, then pickup successful, then received", () => {
    const approved = { ...base, requests: [req("approved", undefined, { decidedAt: "2026-01-02T00:00:00Z", pickupDate: "2026-01-05" })] }
    expect(keys(approved)).toEqual(["requested:done", "approved:done", "pickup:current", "picked_up:upcoming", "received:upcoming", "refund:upcoming"])
    expect(returnTimeline(approved).find((e) => e.key === "pickup")?.note).toMatch(/^Expected pickup by /)
    expect(returnStage(approved)?.key).toBe("approved")

    const pickedUp = { ...base, requests: [req("approved", undefined, { pickupDate: "2026-01-05", pickedUpAt: "2026-01-05T12:00:00Z" })] }
    expect(keys(pickedUp)).toEqual(["requested:done", "approved:done", "pickup:done", "picked_up:current", "received:upcoming", "refund:upcoming"])
    expect(returnStage(pickedUp)?.key).toBe("picked_up")
  })

  it("rejected / withdrawn stop the line", () => {
    expect(keys({ ...base, requests: [req("rejected")] })).toEqual(["requested:done", "rejected:stopped"])
    expect(keys({ ...base, requests: [req("withdrawn")] })).toEqual(["requested:done", "withdrawn:stopped"])
  })

  it("completed return: received done, refund follows the payment", () => {
    const received = { ...base, requests: [req("received")], returns: [ret()] }
    expect(keys(received)).toEqual(["requested:done", "approved:done", "pickup:done", "picked_up:done", "received:done", "refund:upcoming"])
    expect(keys({ ...received, refundedAmount: 1 })).toContain("refund:current")
    expect(keys({ ...base, requests: [req("received")], returns: [ret(true)], refundedAmount: 250 })).toContain("refund:done")
    expect(keys({ ...base, requests: [req("received")], returns: [ret(true), ret(false)], refundedAmount: 250 })).toContain("refund:current")
    expect(keys({ ...received, paymentStatus: "refunded" })).toContain("refund:done")
  })

  it("direct admin return has no request/approval steps", () => {
    expect(keys({ ...base, returns: [ret()] })).toEqual(["received:done", "refund:upcoming"])
  })

  it("never leaks amounts", () => {
    const t = returnTimeline({ ...base, requests: [req("received")], returns: [ret(true)], refundedAmount: 250 })
    expect(JSON.stringify(t)).not.toContain("₹")
  })

  it("uses clear 'Item picked up' and 'Returned item received' labels for both admin and customer on returns", () => {
    const t = returnTimeline({ ...base, requests: [req("requested")] })
    const pickedUp = t.find((e) => e.key === "picked_up")
    const received = t.find((e) => e.key === "received")
    expect(pickedUp).toMatchObject({ label: "Item picked up", customerLabel: "Item picked up" })
    expect(received).toMatchObject({ label: "Returned item received", customerLabel: "Returned item received" })
  })
})

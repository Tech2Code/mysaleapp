import { describe, expect, it } from "vitest"
import { composeReturnDetails, deliveredAt, itemReturnWindow, returnableQuantities, returnWindow, splitReturnDetails } from "./returns"
import type { OrderItem, OrderReturn, StatusHistoryEntry } from "./types"

const h = (status: StatusHistoryEntry["status"], changedAt: string): StatusHistoryEntry => ({ status, changedAt })
const DAY = 86_400_000

describe("deliveredAt", () => {
  it("is null without a delivered entry", () => {
    expect(deliveredAt([h("pending", "2026-01-01T00:00:00Z")])).toBeNull()
  })
  it("takes the latest delivered entry by instant across Z / +00:00 formats", () => {
    const history = [h("delivered", "2026-01-02T10:00:00+00:00"), h("delivered", "2026-01-02T09:00:00.500Z"), h("delivered", "2026-01-01T23:00:00Z")]
    expect(deliveredAt(history)).toBe("2026-01-02T10:00:00+00:00")
    expect(deliveredAt([h("delivered", "2026-01-02T10:00:00Z"), h("delivered", "2026-01-02T10:00:00.1+00:00")])).toBe("2026-01-02T10:00:00.1+00:00")
  })
  it("handles non-UTC offsets", () => {
    expect(deliveredAt([h("delivered", "2026-01-02T10:00:00Z"), h("delivered", "2026-01-02T15:00:00+05:30")])).toBe("2026-01-02T10:00:00Z")
  })
})

describe("returnWindow", () => {
  const history = [h("delivered", "2026-03-01T00:00:00Z")]
  const start = Date.parse("2026-03-01T00:00:00Z")
  it("is open exactly at until and closed one ms after", () => {
    const until = start + 7 * DAY
    const at = returnWindow(history, 7, new Date(until))
    expect(at.open).toBe(true)
    expect(at.until?.getTime()).toBe(until)
    expect(returnWindow(history, 7, new Date(until + 1)).open).toBe(false)
  })
  it("is closed for windowDays 0 or negative", () => {
    expect(returnWindow(history, 0, new Date(start))).toEqual({ until: null, open: false })
    expect(returnWindow(history, -1, new Date(start)).open).toBe(false)
  })
  it("is closed when not delivered", () => {
    expect(returnWindow([h("shipped", "2026-03-01T00:00:00Z")], 7, new Date(start))).toEqual({ until: null, open: false })
  })
  it("uses the latest delivered entry", () => {
    const hist = [h("delivered", "2026-03-01T00:00:00+00:00"), h("delivered", "2026-03-05T00:00:00Z")]
    expect(returnWindow(hist, 7, new Date("2026-03-12T00:00:00Z")).open).toBe(true)
  })
  it("computes itemReturnWindow safely during SSR/prerender when now is null", () => {
    const w = itemReturnWindow(history, 5, 7, null)
    expect(w.days).toBe(5)
    expect(w.open).toBe(true)
    expect(w.until?.getTime()).toBe(start + 5 * DAY)
    expect(itemReturnWindow(history, 0, 7, null)).toEqual({ until: null, open: false, days: 0 })
  })
})

describe("returnableQuantities", () => {
  const item = (productId: string, quantity: number): OrderItem => ({ productId, quantity, name: productId, slug: productId, price: 1, image: null })
  const ret = (...items: [string, number][]) => ({ items: items.map(([productId, quantity]) => ({ productId, quantity })) }) as unknown as OrderReturn
  it("subtracts partial returns", () => {
    const m = returnableQuantities([item("a", 5), item("b", 2)], [ret(["a", 2]), ret(["a", 1], ["b", 2])])
    expect(m.get("a")).toBe(2)
    expect(m.get("b")).toBe(0)
  })
  it("sums the same product across several lines", () => {
    const m = returnableQuantities([item("a", 2), item("a", 3)], [ret(["a", 4])])
    expect(m.get("a")).toBe(1)
  })
  it("is empty with no items", () => {
    expect(returnableQuantities([], []).size).toBe(0)
  })
  it("excludes exchange returns from subtracted quantities", () => {
    const exchangeRet = { items: [{ productId: "a", quantity: 2 }], resolutionType: "exchange" } as unknown as OrderReturn
    const m = returnableQuantities([item("a", 3)], [exchangeRet, ret(["a", 1])])
    expect(m.get("a")).toBe(2)
  })
})

describe("composeReturnDetails / splitReturnDetails", () => {
  it("packs and splits customer details and an alternate pickup address", () => {
    const composed = composeReturnDetails("Arrived with a chip on the rim", "Rohan (+91 9876543210), 12 MG Road, Bengaluru, Karnataka - 560001")
    expect(composed).toBe(
      "Arrived with a chip on the rim\n[Pickup: Rohan (+91 9876543210), 12 MG Road, Bengaluru, Karnataka - 560001]"
    )
    expect(splitReturnDetails(composed)).toEqual({
      details: "Arrived with a chip on the rim",
      pickupAddress: "Rohan (+91 9876543210), 12 MG Road, Bengaluru, Karnataka - 560001",
    })
  })

  it("handles pickup address without extra details, and details without pickup address", () => {
    const onlyPickup = composeReturnDetails("", "Home: Meera (+91 9123456789), 4 Park St, Kolkata - 700016")
    expect(splitReturnDetails(onlyPickup)).toEqual({
      details: null,
      pickupAddress: "Home: Meera (+91 9123456789), 4 Park St, Kolkata - 700016",
    })
    expect(splitReturnDetails(composeReturnDetails("Just a note", null))).toEqual({
      details: "Just a note",
      pickupAddress: null,
    })
  })
})

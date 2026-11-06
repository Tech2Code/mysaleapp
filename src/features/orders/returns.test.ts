import { describe, expect, it } from "vitest"
import { deliveredAt, returnableQuantities, returnWindow } from "./returns"
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
})

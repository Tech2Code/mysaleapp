import { describe, expect, it } from "vitest"
import { describeHours, formatDeadline, paymentDeadline } from "./deadline"

describe("paymentDeadline", () => {
  it("is null when off", () => {
    expect(paymentDeadline("2026-01-01T00:00:00Z", 0)).toBeNull()
    expect(paymentDeadline("2026-01-01T00:00:00Z", -5)).toBeNull()
  })
  it("adds hours to creation", () => {
    expect(paymentDeadline("2026-01-01T00:00:00Z", 24)?.toISOString()).toBe("2026-01-02T00:00:00.000Z")
  })
})

describe("describeHours", () => {
  it.each([
    [1, "1 hour"],
    [2, "2 hours"],
    [24, "24 hours"],
    [36, "36 hours"],
    [48, "2 days"],
    [72, "3 days"],
    [50, "50 hours"],
  ])("%i -> %s", (h, s) => expect(describeHours(h)).toBe(s))
})

describe("formatDeadline", () => {
  it("renders in India time regardless of machine zone", () => {
    expect(formatDeadline(new Date("2026-11-06T11:11:00Z"))).toMatch(/6 Nov.*4:41\s?pm/i)
  })
})

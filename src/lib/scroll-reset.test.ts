import { describe, expect, it } from "vitest"
import { SCROLL_HOLD, holdFinished, shouldResetScroll } from "./scroll-reset"

describe("shouldResetScroll", () => {
  const base = { previousPath: "/", nextPath: "/products", viaHistory: false, hash: "" }

  it("resets when the path changes by a normal click", () => {
    expect(shouldResetScroll(base)).toBe(true)
  })

  it("keeps the position when the path is the same (filters, ?query)", () => {
    expect(shouldResetScroll({ ...base, previousPath: "/products", nextPath: "/products" })).toBe(false)
  })

  it("leaves back / forward to the browser", () => {
    expect(shouldResetScroll({ ...base, viaHistory: true })).toBe(false)
  })

  it("leaves #hash links to the browser", () => {
    expect(shouldResetScroll({ ...base, hash: "#reviews" })).toBe(false)
  })

  it("resets between two pages of the same kind (product to product)", () => {
    expect(shouldResetScroll({ ...base, previousPath: "/products/a", nextPath: "/products/b" })).toBe(true)
  })
})

describe("holdFinished", () => {
  const startedAt = 1000

  it("keeps holding while the height is still changing", () => {
    expect(holdFinished({ now: startedAt + 100, startedAt, lastHeightChangeAt: startedAt + 90 })).toBe(false)
  })

  it("ends once the height has been stable long enough", () => {
    expect(holdFinished({ now: startedAt + 1000, startedAt, lastHeightChangeAt: startedAt + 1000 - SCROLL_HOLD.stableMs })).toBe(true)
  })

  it("ends at the hard cap even if the height keeps changing", () => {
    expect(holdFinished({ now: startedAt + SCROLL_HOLD.maxMs, startedAt, lastHeightChangeAt: startedAt + SCROLL_HOLD.maxMs })).toBe(true)
  })
})

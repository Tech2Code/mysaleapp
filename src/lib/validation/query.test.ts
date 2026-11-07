import { describe, expect, it } from "vitest"
import { firstParam } from "./query"

describe("firstParam", () => {
  it("returns a plain string unchanged", () => expect(firstParam("a")).toBe("a"))
  it("takes the first of a repeated param", () => expect(firstParam(["a", "b"])).toBe("a"))
  it("returns undefined for missing, null or empty array", () => {
    expect(firstParam(undefined)).toBeUndefined()
    expect(firstParam(null)).toBeUndefined()
    expect(firstParam([])).toBeUndefined()
  })
})

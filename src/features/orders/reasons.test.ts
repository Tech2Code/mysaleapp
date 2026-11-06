import { describe, expect, it } from "vitest"
import { cancelReasonText, otherNeedsDetail } from "./reasons"

describe("otherNeedsDetail", () => {
  it("only applies to Other", () => {
    expect(otherNeedsDetail("Changed my mind", "")).toBe(false)
    expect(otherNeedsDetail("Other", "")).toBe(true)
    expect(otherNeedsDetail("Other", undefined)).toBe(true)
    expect(otherNeedsDetail("Other", null)).toBe(true)
  })
  it("trims and needs 5 characters", () => {
    expect(otherNeedsDetail("Other", "   ab   ")).toBe(true)
    expect(otherNeedsDetail("Other", "abcd")).toBe(true)
    expect(otherNeedsDetail("Other", "abcde")).toBe(false)
    expect(otherNeedsDetail("Other", "  abcde ")).toBe(false)
  })
})

describe("cancelReasonText", () => {
  it("replaces Other with the detail", () => {
    expect(cancelReasonText("Other", "too slow")).toBe("too slow")
    expect(cancelReasonText("Other", undefined)).toBe("Other")
  })
  it("appends detail to listed reasons", () => {
    expect(cancelReasonText("Payment problem", "UPI failed")).toBe("Payment problem: UPI failed")
    expect(cancelReasonText("Payment problem", undefined)).toBe("Payment problem")
  })
})

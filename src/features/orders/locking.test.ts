import { describe, expect, it } from "vitest"
import { isOrderLocked, lockedMessage, lockNote } from "./locking"
import { ORDER_STATUSES } from "./types"

describe("order edit lock", () => {
  it("locks exactly delivered and cancelled orders", () => {
    expect(ORDER_STATUSES.filter(isOrderLocked)).toEqual(["delivered", "cancelled"])
  })

  it("has a note and a refusal message only for locked orders", () => {
    for (const s of ORDER_STATUSES) {
      expect(lockNote(s) !== null).toBe(isOrderLocked(s))
      expect(lockedMessage(s) !== null).toBe(isOrderLocked(s))
    }
  })

  it("tells the admin what is still possible", () => {
    expect(lockedMessage("delivered")).toMatch(/return/i)
    expect(lockedMessage("delivered")).toMatch(/refund/i)
    expect(lockNote("delivered")).toBe("Delivered — details are locked.")
  })
})

import { describe, expect, it } from "vitest"
import { addDays, todayIST } from "@/lib/validation"
import { cancelOrderSchema, expectedDeliveryProblem, requestReturnSchema, shippingSchema } from "./schema"

const base = { carrier: "Delhivery" }

describe("shippingSchema", () => {
  it("normalises the tracking number and accepts blanks", () => {
    expect(shippingSchema.parse({ ...base, trackingNumber: " awb-1234 " }).trackingNumber).toBe("AWB-1234")
    const blank = shippingSchema.parse({ ...base, trackingNumber: "  ", trackingUrl: "", expectedDelivery: "" })
    expect(blank.trackingNumber).toBeUndefined()
    expect(blank.trackingUrl).toBeUndefined()
    expect(blank.expectedDelivery).toBeUndefined()
  })
  it("rejects bad tracking numbers", () => {
    for (const bad of ["AB12", "A".repeat(31), "AB 123456", "AB#123456"]) {
      expect(shippingSchema.safeParse({ ...base, trackingNumber: bad }).success, bad).toBe(false)
    }
  })
  it("tracking link must be https", () => {
    expect(shippingSchema.safeParse({ ...base, trackingUrl: "https://t.example.com/1" }).success).toBe(true)
    expect(shippingSchema.safeParse({ ...base, trackingUrl: "http://t.example.com/1" }).success).toBe(false)
  })
  it("expected delivery is a real day within 90 days", () => {
    const today = todayIST()
    expect(shippingSchema.safeParse({ ...base, expectedDelivery: addDays(today, 5) }).success).toBe(true)
    expect(shippingSchema.safeParse({ ...base, expectedDelivery: addDays(today, 91) }).success).toBe(false)
    expect(shippingSchema.safeParse({ ...base, expectedDelivery: "2026-02-31" }).success).toBe(false)
  })
  it("courier needs 2-60 characters", () => {
    expect(shippingSchema.safeParse({ carrier: "D" }).success).toBe(false)
    expect(shippingSchema.safeParse({ carrier: "D".repeat(61) }).success).toBe(false)
  })
})

describe("expectedDeliveryProblem", () => {
  const today = "2026-06-10"
  it("refuses a changed date in the past, allows an unchanged one", () => {
    expect(expectedDeliveryProblem("2026-06-09", null, today)).not.toBeNull()
    expect(expectedDeliveryProblem("2026-06-09", "2026-06-09", today)).toBeNull()
    expect(expectedDeliveryProblem("2026-06-10", null, today)).toBeNull()
    expect(expectedDeliveryProblem(undefined, "2026-06-01", today)).toBeNull()
  })
})

describe("reason and quantity limits", () => {
  const code = "KK-ABC123"
  it("cancel detail is capped at 200", () => {
    expect(cancelOrderSchema.safeParse({ code, reason: "Changed my mind", detail: "x".repeat(201) }).success).toBe(false)
    expect(cancelOrderSchema.safeParse({ code, reason: "Changed my mind", detail: "x".repeat(200) }).success).toBe(true)
  })
  it("return quantity 1..20 and details capped at 300", () => {
    const item = (quantity: number) => ({ productId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301", quantity })
    const ok = { code, reason: "Damaged", details: "x".repeat(300) }
    expect(requestReturnSchema.safeParse({ ...ok, items: [item(20)] }).success).toBe(true)
    expect(requestReturnSchema.safeParse({ ...ok, items: [item(21)] }).success).toBe(false)
    expect(requestReturnSchema.safeParse({ ...ok, items: [item(0)] }).success).toBe(false)
    expect(requestReturnSchema.safeParse({ ...ok, details: "x".repeat(301), items: [item(1)] }).success).toBe(false)
  })
})

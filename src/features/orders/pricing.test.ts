import { describe, expect, it } from "vitest"
import type { StoreSettings } from "@/features/settings/types"
import { calculateCharges } from "./pricing"

const settings = (deliveryFee: number, freeDeliveryAbove: number) => ({ deliveryFee, freeDeliveryAbove }) as StoreSettings

describe("calculateCharges", () => {
  it("adds a product fee once, not times quantity", () => {
    const c = calculateCharges([{ price: 100, quantity: 5, name: "Vase", fees: [{ label: "Handling", amount: 30 }] }], settings(0, 0))
    expect(c.subtotal).toBe(500)
    expect(c.extraFees).toEqual([{ label: "Handling", amount: 30, productName: "Vase" }])
    expect(c.total).toBe(530)
  })

  it("frees delivery exactly at the threshold and charges just below it", () => {
    expect(calculateCharges([{ price: 500, quantity: 1 }], settings(50, 500)).shippingFee).toBe(0)
    const below = calculateCharges([{ price: 499.99, quantity: 1 }], settings(50, 500))
    expect(below.shippingFee).toBe(50)
    expect(below.amountToFreeDelivery).toBe(0.01)
  })

  it("keeps the original fee for the strike-through when waived", () => {
    const c = calculateCharges([{ price: 600, quantity: 1 }], settings(50, 500))
    expect(c).toMatchObject({ shippingFee: 0, shippingFeeOriginal: 50, amountToFreeDelivery: 0, total: 600 })
  })

  it("never frees delivery when freeDeliveryAbove is 0", () => {
    const c = calculateCharges([{ price: 100000, quantity: 1 }], settings(50, 0))
    expect(c.shippingFee).toBe(50)
    expect(c.amountToFreeDelivery).toBe(0)
  })

  it("charges nothing for an empty cart", () => {
    expect(calculateCharges([], settings(50, 500))).toEqual({
      subtotal: 0,
      shippingFee: 0,
      shippingFeeOriginal: 0,
      extraFees: [],
      total: 0,
      amountToFreeDelivery: 0,
    })
  })

  it("rounds float sums to 2 decimals", () => {
    expect(calculateCharges([{ price: 0.1, quantity: 3 }], settings(0, 0)).subtotal).toBe(0.3)
    expect(calculateCharges([{ price: 19.99, quantity: 3 }], settings(0, 0)).subtotal).toBe(59.97)
    expect(calculateCharges([{ price: 0.1, quantity: 3, fees: [{ label: "A", amount: 0.2 }] }], settings(0, 0)).total).toBe(0.5)
  })

  it("orders fees by product name then label and drops zero fees", () => {
    const c = calculateCharges(
      [
        { price: 1, quantity: 1, name: "Zed", fees: [{ label: "Gift", amount: 5 }] },
        { price: 1, quantity: 1, name: "Alpha", fees: [{ label: "Wrap", amount: 2 }, { label: "Box", amount: 3 }, { label: "Free", amount: 0 }] },
      ],
      settings(0, 0)
    )
    expect(c.extraFees.map((f) => `${f.productName}/${f.label}`)).toEqual(["Alpha/Box", "Alpha/Wrap", "Zed/Gift"])
  })

  it("includes the fee reason when given", () => {
    const c = calculateCharges([{ price: 1, quantity: 1, name: "A", fees: [{ label: "Pack", amount: 5, reason: "Fragile" }] }], settings(0, 0))
    expect(c.extraFees[0].reason).toBe("Fragile")
  })
})

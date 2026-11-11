import { describe, expect, it } from "vitest"
import type { StoreSettings } from "@/features/settings/types"
import { calculateCharges, describeProductSurcharges, formatWeightGrams } from "./pricing"

const settings = (
  deliveryFee: number,
  freeDeliveryAbove: number,
  extra: Partial<Pick<StoreSettings, "fragileFee" | "oversizedFee" | "freeWeightGrams" | "extraWeightFeePerKg">> = {}
) =>
  ({
    deliveryFee,
    freeDeliveryAbove,
    fragileFee: extra.fragileFee ?? 30,
    oversizedFee: extra.oversizedFee ?? 80,
    freeWeightGrams: extra.freeWeightGrams ?? 1000,
    extraWeightFeePerKg: extra.extraWeightFeePerKg ?? 40,
  }) as StoreSettings

describe("formatWeightGrams", () => {
  it("formats grams and trims trailing zeroes for kilograms", () => {
    expect(formatWeightGrams(0)).toBe("0 g")
    expect(formatWeightGrams(350)).toBe("350 g")
    expect(formatWeightGrams(1000)).toBe("1 kg")
    expect(formatWeightGrams(1400)).toBe("1.4 kg")
    expect(formatWeightGrams(1250)).toBe("1.25 kg")
    expect(formatWeightGrams(2000)).toBe("2 kg")
  })
})

describe("calculateCharges", () => {
  it("charges no extra fees for standard parcel items within the included weight", () => {
    const c = calculateCharges([{ price: 200, quantity: 2, name: "Earrings", weightGrams: 100, shippingClass: "standard" }], settings(60, 999))
    expect(c).toEqual({
      subtotal: 400,
      shippingFee: 60,
      shippingFeeOriginal: 60,
      extraFees: [],
      total: 460,
      amountToFreeDelivery: 599,
    })
  })

  it("adds fragile packaging ONCE per order, never multiplied by quantity or item count", () => {
    const c = calculateCharges(
      [
        { price: 100, quantity: 5, name: "Vase", shippingClass: "fragile", weightGrams: 100 },
        { price: 150, quantity: 2, name: "Candle", shippingClass: "fragile", weightGrams: 100 },
      ],
      settings(0, 0, { fragileFee: 30 })
    )
    expect(c.subtotal).toBe(800)
    expect(c.extraFees).toEqual([
      {
        label: "Fragile item packaging",
        amount: 30,
        productName: "Candle, Vase",
        reason: "Protective bubble & box cushioning for fragile items",
      },
    ])
    expect(c.total).toBe(830)
  })

  it("picks the single highest handling tier (oversized over fragile) so mixed carts are never double-charged", () => {
    const c = calculateCharges(
      [
        { price: 400, quantity: 1, name: "Soy Candle", shippingClass: "fragile" },
        { price: 1200, quantity: 2, name: "Wall Mirror", shippingClass: "oversized" },
      ],
      settings(60, 999, { fragileFee: 30, oversizedFee: 80 })
    )
    expect(c.subtotal).toBe(2800)
    expect(c.shippingFee).toBe(0)
    expect(c.shippingFeeOriginal).toBe(60)
    expect(c.extraFees).toEqual([
      {
        label: "Large / bulky item handling",
        amount: 80,
        productName: "Wall Mirror",
        reason: "Special courier handling & protective packing for large items",
      },
    ])
    expect(c.total).toBe(2880)
  })

  it("falls back to fragile fee when oversizedFee is 0 and cart has both oversized and fragile items", () => {
    const c = calculateCharges(
      [
        { price: 300, quantity: 1, name: "Candle", shippingClass: "fragile" },
        { price: 900, quantity: 1, name: "Frame", shippingClass: "oversized" },
      ],
      settings(0, 0, { fragileFee: 35, oversizedFee: 0 })
    )
    expect(c.extraFees).toEqual([
      {
        label: "Fragile item packaging",
        amount: 35,
        productName: "Candle",
        reason: "Protective bubble & box cushioning for fragile items",
      },
    ])
  })

  it("computes heavy-parcel courier slabs across TOTAL cart weight (weightGrams × quantity)", () => {
    // 1 × 350g = 350g <= 1000g → no weight surcharge
    expect(
      calculateCharges([{ price: 449, quantity: 1, name: "Candle", weightGrams: 350 }], settings(0, 0, { freeWeightGrams: 1000, extraWeightFeePerKg: 40 })).extraFees
    ).toEqual([])

    // Exact boundary 1000g → no weight surcharge
    expect(
      calculateCharges([{ price: 500, quantity: 2, name: "Runner", weightGrams: 500 }], settings(0, 0, { freeWeightGrams: 1000, extraWeightFeePerKg: 40 })).extraFees
    ).toEqual([])

    // 4 × 350g = 1400g → 400g over 1kg → ceil(0.4) = 1 extra kg × ₹40 = ₹40
    const fourCandles = calculateCharges(
      [{ price: 400, quantity: 4, name: "Candle", weightGrams: 350 }],
      settings(60, 999, { freeWeightGrams: 1000, extraWeightFeePerKg: 40 })
    )
    expect(fourCandles.shippingFee).toBe(0)
    expect(fourCandles.extraFees).toEqual([
      {
        label: "Heavy parcel surcharge",
        amount: 40,
        reason: "Total parcel weight 1.4 kg (1 kg above 1 kg included)",
      },
    ])
    expect(fourCandles.total).toBe(1640)

    // 1 × 2300g → 1300g over 1kg → ceil(1.3) = 2 extra kg × ₹40 = ₹80
    const heavyUrli = calculateCharges(
      [{ price: 1500, quantity: 1, name: "Brass Urli", weightGrams: 2300, shippingClass: "fragile" }],
      settings(60, 999, { fragileFee: 30, freeWeightGrams: 1000, extraWeightFeePerKg: 40 })
    )
    expect(heavyUrli.extraFees).toEqual([
      {
        label: "Fragile item packaging",
        amount: 30,
        productName: "Brass Urli",
        reason: "Protective bubble & box cushioning for fragile items",
      },
      {
        label: "Heavy parcel surcharge",
        amount: 80,
        reason: "Total parcel weight 2.3 kg (2 kg above 1 kg included)",
      },
    ])
    expect(heavyUrli.total).toBe(1610)
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

  it("charges nothing for an empty cart or zero-quantity lines", () => {
    expect(calculateCharges([], settings(50, 500))).toEqual({
      subtotal: 0,
      shippingFee: 0,
      shippingFeeOriginal: 0,
      extraFees: [],
      total: 0,
      amountToFreeDelivery: 0,
    })
    expect(
      calculateCharges([{ price: 500, quantity: 0, shippingClass: "oversized", weightGrams: 5000 }], settings(50, 500)).extraFees
    ).toEqual([])
  })

  it("rounds float sums to 2 decimals", () => {
    expect(calculateCharges([{ price: 0.1, quantity: 3 }], settings(0, 0)).subtotal).toBe(0.3)
    expect(calculateCharges([{ price: 19.99, quantity: 3 }], settings(0, 0)).subtotal).toBe(59.97)
    expect(calculateCharges([{ price: 0.1, quantity: 3, shippingClass: "fragile" }], settings(0, 0, { fragileFee: 0.2 })).total).toBe(0.5)
  })
})

describe("describeProductSurcharges", () => {
  it("explains applicable handling and heavy unit weight on product detail pages", () => {
    const s = settings(60, 999, { fragileFee: 30, oversizedFee: 80, freeWeightGrams: 1000, extraWeightFeePerKg: 40 })
    expect(describeProductSurcharges({ shippingClass: "standard", weightGrams: 300 }, s)).toEqual([])
    expect(describeProductSurcharges({ shippingClass: "fragile", weightGrams: 350 }, s)).toHaveLength(1)
    expect(describeProductSurcharges({ shippingClass: "oversized", weightGrams: 1800 }, s)).toHaveLength(2)
  })
})

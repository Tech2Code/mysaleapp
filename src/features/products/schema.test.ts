import { describe, expect, it } from "vitest"
import { productSchema } from "./schema"

const base = {
  name: "Candle",
  slug: "candle",
  description: "",
  price: 100,
  compareAtPrice: null,
  images: [],
  categoryId: null,
  stock: 3,
  weightGrams: 350,
  shippingClass: "fragile" as const,
  shortDescription: null,
  highlights: "a\nb",
  specs: [],
  careInstructions: null,
  isActive: true,
  isFeatured: false,
}

describe("productSchema", () => {
  // Regression: the form sends the parsed output (highlights already an array) to the server action,
  // which parses again. That used to fail with "Invalid input: expected string, received array".
  it("is idempotent: its own output parses again", () => {
    const first = productSchema.parse(base)
    expect(first.highlights).toEqual(["a", "b"])
    expect(first.weightGrams).toBe(350)
    expect(first.shippingClass).toBe("fragile")
    expect(productSchema.parse(first).highlights).toEqual(["a", "b"])
  })
  it("accepts an empty highlights array and defaults blank weightGrams to 0", () => {
    const parsed = productSchema.parse({ ...base, highlights: [], weightGrams: "" })
    expect(parsed.highlights).toEqual([])
    expect(parsed.weightGrams).toBe(0)
  })
  it("validates weightGrams (0..50000 whole number) and shippingClass", () => {
    expect(productSchema.safeParse({ ...base, weightGrams: -1 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, weightGrams: 50001 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, weightGrams: 12.5 }).success).toBe(false)
    expect(productSchema.safeParse({ ...base, shippingClass: "invalid" }).success).toBe(false)
  })
})

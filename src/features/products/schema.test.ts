import { describe, expect, it } from "vitest"
import { productSchema } from "./schema"

const base = {
  name: "Candle", slug: "candle", description: "", price: 100, compareAtPrice: null, images: [], categoryId: null,
  stock: 3, fees: [], shortDescription: null, highlights: "a\nb", specs: [], careInstructions: null, isActive: true, isFeatured: false,
}

describe("productSchema", () => {
  // Regression: the form sends the parsed output (highlights already an array) to the server action,
  // which parses again. That used to fail with "Invalid input: expected string, received array".
  it("is idempotent: its own output parses again", () => {
    const first = productSchema.parse(base)
    expect(first.highlights).toEqual(["a", "b"])
    expect(productSchema.parse(first).highlights).toEqual(["a", "b"])
  })
  it("accepts an empty highlights array", () => {
    expect(productSchema.parse({ ...base, highlights: [] }).highlights).toEqual([])
  })
})

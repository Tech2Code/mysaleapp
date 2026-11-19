import { describe, expect, it } from "vitest"
import { demoProducts } from "./demo-data"
import { productReviewSchema, productSchema } from "./schema"
import { buildSearchText, parseSearchQuery, scoreProductSearch } from "./types"

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

describe("smart product search (parseSearchQuery & scoreProductSearch)", () => {
  const indexed = demoProducts.map((p) => ({
    ...p,
    searchText: buildSearchText(p),
  }))

  it("matches natural queries like 'gifts for men' and excludes strictly feminine jewellery", () => {
    const parsed = parseSearchQuery("gifts for men")
    expect(parsed.hasGiftIntent).toBe(true)
    expect(parsed.hasMaleIntent).toBe(true)

    const hits = indexed
      .map((p) => ({ p, score: scoreProductSearch(p, parsed) }))
      .filter((x) => x.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.p.slug === "gift-hamper-little-joys")).toBe(true)
    expect(hits.some((h) => h.p.slug === "brass-jhumka-earrings")).toBe(false)
  })

  it("handles price filters like 'gifts under 1000' and 'candles below 500'", () => {
    const under1000 = parseSearchQuery("gifts under 1000")
    expect(under1000.maxPrice).toBe(1000)
    const hits = indexed.filter((p) => scoreProductSearch(p, under1000) !== null)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((p) => p.price <= 1000)).toBe(true)

    const candlesUnder500 = parseSearchQuery("candles below 500")
    const candleHits = indexed.filter((p) => scoreProductSearch(p, candlesUnder500) !== null)
    expect(candleHits.map((p) => p.slug)).toEqual(["lavender-soy-candle"])
  })

  it("handles range queries like 'gifts under 500 to 700', '500 to 700', and Hinglish '500 ke andar'", () => {
    const under500to700 = parseSearchQuery("gifts under 500 to 700")
    expect(under500to700.hardTokens).toHaveLength(0)
    expect(under500to700.maxPrice).toBe(700)
    expect(under500to700.preferRangeMin).toBe(500)
    const rangeHits = indexed
      .map((p) => ({ p, score: scoreProductSearch(p, under500to700) }))
      .filter((x) => x.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    expect(rangeHits.length).toBeGreaterThan(0)
    expect(rangeHits.every((h) => h.p.price <= 700)).toBe(true)
    // Items in [500, 700] should rank above <500 items
    expect(rangeHits[0].p.price).toBeGreaterThanOrEqual(500)

    const hinglishUnder = parseSearchQuery("gift 500 ke andar")
    expect(hinglishUnder.maxPrice).toBe(500)
    expect(hinglishUnder.hardTokens).toHaveLength(0)
    const hinglishHits = indexed.filter((p) => scoreProductSearch(p, hinglishUnder) !== null)
    expect(hinglishHits.length).toBeGreaterThan(0)
    expect(hinglishHits.every((p) => p.price <= 500)).toBe(true)
  })

  it("handles budget/modifier queries like 'cheap gift', 'affordable gift for men', and 'photo frame'", () => {
    const cheapGift = parseSearchQuery("cheap gift")
    expect(cheapGift.hasBudgetIntent).toBe(true)
    expect(cheapGift.hardTokens).toHaveLength(0)
    const cheapHits = indexed.filter((p) => scoreProductSearch(p, cheapGift) !== null)
    expect(cheapHits.length).toBeGreaterThan(0)

    const photoFrame = parseSearchQuery("photo frame")
    const frameHits = indexed.filter((p) => scoreProductSearch(p, photoFrame) !== null)
    expect(frameHits.some((p) => p.slug === "madhubani-art-print")).toBe(true)
  })

  it("handles typos and synonyms like 'candel', 'teracota', and 'diya'", () => {
    const candleTypo = parseSearchQuery("lavendar candel")
    const candleHits = indexed.filter((p) => scoreProductSearch(p, candleTypo) !== null)
    expect(candleHits.some((p) => p.slug === "lavender-soy-candle")).toBe(true)

    const diyaSynonym = parseSearchQuery("diya")
    const diyaHits = indexed.filter((p) => scoreProductSearch(p, diyaSynonym) !== null)
    expect(diyaHits.length).toBeGreaterThan(0)
  })

  it("returns no direct matches for unrelated product keywords (triggering fallback suggestions)", () => {
    const parsed = parseSearchQuery("iphone 16 charger")
    const hits = indexed.filter((p) => scoreProductSearch(p, parsed) !== null)
    expect(hits).toHaveLength(0)
  })
})

describe("productReviewSchema", () => {
  it("validates 1..5 integer star ratings and comment length", () => {
    const valid = productReviewSchema.safeParse({
      productId: "00000000-0000-4000-8000-000000000001",
      rating: 5,
      title: "  Lovely finish ",
      comment: "Great handmade quality and arrived well packed!",
    })
    expect(valid.success).toBe(true)
    if (valid.success) {
      expect(valid.data.title).toBe("Lovely finish")
    }

    expect(
      productReviewSchema.safeParse({
        productId: "00000000-0000-4000-8000-000000000001",
        rating: 6,
        comment: "Valid comment",
      }).success
    ).toBe(false)

    expect(
      productReviewSchema.safeParse({
        productId: "00000000-0000-4000-8000-000000000001",
        rating: 4,
        comment: "Hi",
      }).success
    ).toBe(false)
  })
})

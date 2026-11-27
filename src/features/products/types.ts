export type Category = {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string | null
  sort: number
  reviewAspects: string[]
}

/**
 * Physical handling tier of a product. Rates are configured centrally in Store Settings
 * (Admin → Settings → Delivery & handling charges) and applied intelligently once per order.
 */
export const SHIPPING_CLASSES = ["standard", "fragile", "oversized"] as const
export type ShippingClass = (typeof SHIPPING_CLASSES)[number]

export function isShippingClass(value: unknown): value is ShippingClass {
  return typeof value === "string" && (SHIPPING_CLASSES as readonly string[]).includes(value)
}

export type ProductSpec = { label: string; value: string }

/** Optional sellable variant (e.g. Color: Black + Size: M) with its own price and stock. */
export type ProductVariant = {
  id: string
  label: string
  /** Structured option map for multi-attribute products, e.g. { Color: "Black", Size: "M" }. */
  options?: Record<string, string>
  price: number
  compareAtPrice?: number | null
  stock: number
  sku?: string | null
}

/** Extracts ordered option groups (e.g. [{ name: "Color", values: ["Black", "White"] }, { name: "Size", values: ["S", "M", "L"] }]) from variants. */
export function extractVariantOptionGroups(variants: readonly ProductVariant[]): { name: string; values: string[] }[] {
  const order: string[] = []
  const map = new Map<string, string[]>()
  for (const v of variants) {
    if (!v.options) continue
    for (const [rawKey, rawVal] of Object.entries(v.options)) {
      const key = rawKey.trim()
      const val = rawVal.trim()
      if (!key || !val) continue
      if (!map.has(key)) {
        order.push(key)
        map.set(key, [])
      }
      const list = map.get(key)!
      if (!list.includes(val)) list.push(val)
    }
  }
  return order.map((name) => ({ name, values: map.get(name) ?? [] }))
}

export type ProductReview = {
  id: string
  productId: string
  userId: string | null
  reviewerName: string
  rating: number
  title: string | null
  comment: string
  isVerifiedPurchase: boolean
  createdAt: string
  updatedAt: string
}

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice: number | null
  images: string[]
  categoryId: string | null
  category: { name: string; slug: string; reviewAspects?: string[] } | null
  stock: number
  /** Unit parcel weight in grams (0 = light/standard item). Used for heavy-parcel courier slabs. */
  weightGrams: number
  /** Physical handling class (standard / fragile / oversized). */
  shippingClass: ShippingClass
  /** Per-product return & exchange window in days after delivery (null = use store default; 0 = non-returnable). */
  returnWindowDays?: number | null
  /** One or two sentences shown right under the price. */
  shortDescription: string | null
  /** Key selling points (max 6), shown as a checklist near the price. */
  highlights: string[]
  /** Material, size, weight… shown as a table. */
  specs: ProductSpec[]
  careInstructions: string | null
  /** Optional per-product "Why do you love it?" review aspects (empty = inherit category or default). */
  reviewAspects: string[]
  isActive: boolean
  isFeatured: boolean
  seoTitle: string | null
  seoDescription: string | null
  /** Average verified star rating (0 when no reviews yet). */
  ratingAvg?: number
  /** Total verified customer reviews count. */
  reviewCount?: number
  /** Timestamp when a sold-out product was restocked (added by migration 0068). */
  restockedAt?: string | null
  /** Optional sellable variants (Size / Colour / Capacity / Pack). Empty array = single-SKU product. */
  variants?: ProductVariant[]
  createdAt: string
  updatedAt: string
}

/** Number of days a restocked product displays the "Back in stock" badge. */
export const BACK_IN_STOCK_DAYS = 7

/** True when a product is currently in stock and was restocked within the last `BACK_IN_STOCK_DAYS` days. */
export function isBackInStock(
  product: { stock: number; restockedAt?: string | null },
  nowMs?: number
): boolean {
  if (product.stock <= 0 || !product.restockedAt) return false
  const ts = Date.parse(product.restockedAt)
  if (!Number.isFinite(ts)) return false
  if (nowMs === undefined) return true
  const ageMs = nowMs - ts
  return ageMs >= -60_000 && ageMs <= BACK_IN_STOCK_DAYS * 86_400_000
}

export type StockAlert = {
  id: string
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  productStock: number
  customerName: string
  phone: string
  status: "waiting" | "notified"
  notifiedAt: string | null
  createdAt: string
}

/** Shape of a `products` row joined with its category, as returned by Supabase. */
export type ProductRow = {
  id: string
  name: string
  slug: string
  description: string
  price: number | string
  compare_at_price: number | string | null
  images: string[] | null
  category_id: string | null
  category: { name: string; slug: string; review_aspects?: string[] | null } | null
  stock: number
  /** Added by migration 0046; optional so the app keeps working before it is applied. */
  weight_grams?: number | null
  shipping_class?: string | null
  return_window_days?: number | null
  short_description?: string | null
  highlights?: string[] | null
  specs?: ProductSpec[] | null
  care_instructions?: string | null
  review_aspects?: string[] | null
  is_active: boolean
  is_featured: boolean
  seo_title: string | null
  seo_description: string | null
  rating_avg?: number | string | null
  review_count?: number | null
  /** Added by migration 0068; optional so the app keeps working before it is applied. */
  restocked_at?: string | null
  /** Added by migration 0069; optional so the app keeps working before it is applied. */
  variants?: ProductVariant[] | null
  created_at: string
  updated_at: string
}

export type CategoryRow = {
  id: string
  name: string
  slug: string
  description: string
  image_url: string | null
  sort: number
  review_aspects?: string[] | null
}

export const PRODUCT_SELECT = "*, category:categories(name, slug, review_aspects)"

function normalizeVariants(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return []
  const out: ProductVariant[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const v = item as Record<string, unknown>
    const id = typeof v.id === "string" ? v.id.trim() : ""
    const label = typeof v.label === "string" ? v.label.trim() : ""
    const price = Number(v.price)
    const stock = Number(v.stock)
    if (!id || !label || !Number.isFinite(price) || price < 1 || !Number.isFinite(stock) || stock < 0) continue
    const rawCompare = v.compareAtPrice == null ? null : Number(v.compareAtPrice)
    const compareAtPrice = rawCompare != null && Number.isFinite(rawCompare) && rawCompare > price ? rawCompare : null
    const sku = typeof v.sku === "string" && v.sku.trim() ? v.sku.trim() : null
    let options: Record<string, string> | undefined
    if (v.options && typeof v.options === "object" && !Array.isArray(v.options)) {
      const cleanOpts: Record<string, string> = {}
      for (const [ok, ov] of Object.entries(v.options as Record<string, unknown>)) {
        if (typeof ov === "string" && ok.trim() && ov.trim()) {
          cleanOpts[ok.trim()] = ov.trim()
        }
      }
      if (Object.keys(cleanOpts).length > 0) options = cleanOpts
    }
    out.push({ id, label, ...(options ? { options } : {}), price, compareAtPrice, stock: Math.trunc(stock), sku })
  }
  return out
}

export function mapProduct(row: ProductRow): Product {
  const rawWeight = Number(row.weight_grams ?? 0)
  const variants = normalizeVariants(row.variants)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    images: row.images ?? [],
    categoryId: row.category_id,
    category: row.category
      ? {
          name: row.category.name,
          slug: row.category.slug,
          reviewAspects: row.category.review_aspects ?? [],
        }
      : null,
    stock: row.stock,
    weightGrams: Number.isFinite(rawWeight) && rawWeight > 0 ? Math.trunc(rawWeight) : 0,
    shippingClass: isShippingClass(row.shipping_class) ? row.shipping_class : "standard",
    returnWindowDays:
      row.return_window_days == null || !Number.isFinite(Number(row.return_window_days))
        ? null
        : Math.max(0, Math.trunc(Number(row.return_window_days))),
    shortDescription: row.short_description ?? null,
    highlights: row.highlights ?? [],
    specs: row.specs ?? [],
    careInstructions: row.care_instructions ?? null,
    reviewAspects: row.review_aspects ?? [],
    isActive: row.is_active,
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    ratingAvg: Number(row.rating_avg ?? 0),
    reviewCount: Number(row.review_count ?? 0),
    restockedAt: row.restocked_at ?? null,
    variants,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    sort: row.sort,
    reviewAspects: row.review_aspects ?? [],
  }
}

/** Everything a product card needs. Keep client props this small: they are serialized into the page. */
export type ProductCardData = Pick<
  Product,
  "id" | "slug" | "name" | "price" | "compareAtPrice" | "images" | "stock" | "category" | "ratingAvg" | "reviewCount" | "restockedAt" | "variants"
>

/** What the client-side shop browser needs: card fields + sort keys + a precomputed lowercase search string. */
export type ProductListItem = ProductCardData & {
  isFeatured: boolean
  createdAt: string
  searchText: string
}

/** Picks only the card fields (so a full Product is never serialized to the client for a card). */
export function toCardData(p: ProductCardData): ProductCardData {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    stock: p.stock,
    category: p.category,
    ...(p.ratingAvg !== undefined ? { ratingAvg: p.ratingAvg } : {}),
    ...(p.reviewCount !== undefined ? { reviewCount: p.reviewCount } : {}),
    ...(p.restockedAt !== undefined ? { restockedAt: p.restockedAt } : {}),
    ...(p.variants && p.variants.length > 0 ? { variants: p.variants } : {}),
  }
}

export function buildSearchText(p: Product): string {
  return [
    p.name,
    p.shortDescription ?? "",
    p.description,
    p.category?.name ?? "",
    p.category?.slug ?? "",
    ...(p.highlights ?? []),
    ...(p.specs ?? []).map((s) => `${s.label} ${s.value}`),
    p.seoTitle ?? "",
    p.seoDescription ?? "",
  ]
    .join("\n")
    .toLowerCase()
}

export function toListItem(p: Product): ProductListItem {
  return {
    ...toCardData(p),
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
    searchText: buildSearchText(p),
  }
}

const SEARCH_STOPWORDS = new Set([
  "for", "to", "in", "on", "at", "by", "with", "from", "of", "the", "a", "an", "and", "or",
  "is", "are", "best", "good", "top", "nice", "new", "buy", "online", "shop", "store",
  "items", "item", "products", "product", "something", "me", "my", "our", "all", "some",
  "under", "below", "above", "over", "upto", "within", "between", "less", "more", "than",
  "around", "near", "approx", "rs", "inr", "rupee", "rupees", "rupaye", "rupess", "price",
  "range", "ke", "ka", "ki", "ko", "se", "mein", "par", "pe", "wala", "wali", "wale",
  "liye", "aur", "ya", "dikhao", "chahiye", "do", "batao", "lena", "hai", "accha", "acche",
  "achi", "badiya", "badhiya", "mast", "andar", "neeche", "niche", "upar", "kam", "jyada",
  "zyada", "tak", "lagbhag", "aas", "paas",
])

const BUDGET_INTENT_WORDS = new Set([
  "cheap", "cheapest", "sasta", "saste", "sasti", "affordable", "budget", "pocket", "low", "economical",
])

const SOFT_MODIFIER_WORDS = new Set([
  "small", "chota", "choti", "big", "bada", "badi", "large", "medium", "mini", "tall", "short",
  "round", "square", "red", "laal", "blue", "neela", "green", "hara", "yellow", "peela",
  "pink", "gulabi", "black", "kala", "white", "safed", "gold", "golden", "sunehra", "silver",
  "chandi", "brown", "beige", "orange", "purple", "multicolor", "colorful", "colourful",
  "expensive", "mehenga", "friendly",
])

const MALE_CONTEXT_WORDS = new Set([
  "men", "man", "mens", "male", "boy", "boys", "him", "husband", "father", "dad", "brother",
  "boyfriend", "gents", "bhai", "bhaiya", "papa", "pitaji", "pati", "beta", "uncle",
])

const FEMALE_CONTEXT_WORDS = new Set([
  "women", "woman", "womens", "female", "girl", "girls", "her", "wife", "mother", "mom",
  "sister", "girlfriend", "ladies", "behen", "didi", "mummy", "maa", "patni", "beti", "aunty", "bhabhi",
])

const OCCASION_CONTEXT_WORDS = new Set([
  "couple", "couples", "friends", "friend", "dost", "family", "parents", "kids", "home", "house",
  "room", "living", "bedroom", "office", "desk", "decor", "decoration", "decorative", "festive",
  "festival", "diwali", "eid", "christmas", "rakhi", "holi", "wedding", "anniversary", "birthday",
  "housewarming", "return", "corporate", "occasion", "special", "luxury", "premium",
  "unique", "cute", "aesthetic", "modern", "traditional", "indian", "handcrafted", "handmade", "artisan",
])

const GIFT_INTENT_STEMS = new Set(["gift", "present", "hamper"])

const FEMININE_ONLY_PATTERNS = /\b(jhumka|jhumkas|earring|earrings|necklace|bangle|bangles|anklet|saree|lehenga|bindi|kundan)\b/i

const SEARCH_SYNONYMS: Record<string, string[]> = {
  candle: ["candle", "soy", "lavender", "jar", "wax", "fragrance", "aroma", "scent"],
  diya: ["candle", "terracotta", "decor", "light"],
  lamp: ["candle", "light", "decor"],
  light: ["candle", "decor"],
  aroma: ["candle", "lavender", "soy", "fragrance"],
  scent: ["candle", "lavender", "soy"],
  fragrance: ["candle", "lavender", "soy"],
  vase: ["vase", "terracotta", "flower", "pot", "planter", "clay", "ceramic"],
  pot: ["vase", "terracotta", "clay", "decor"],
  planter: ["vase", "terracotta", "decor"],
  clay: ["terracotta", "vase", "hand-painted"],
  ceramic: ["terracotta", "vase", "decor"],
  flower: ["vase", "terracotta", "decor"],
  wall: ["wall", "art", "macrame", "madhubani", "print", "hanging", "name", "plate"],
  painting: ["madhubani", "art", "print", "hand-painted", "wall"],
  frame: ["print", "madhubani", "wall", "art"],
  photo: ["frame", "print", "madhubani", "wall", "art"],
  poster: ["print", "madhubani", "wall", "art"],
  boho: ["macrame", "wall", "hanging", "jute", "cotton"],
  jewel: ["jewellery", "jhumka", "earring", "brass", "antique"],
  earring: ["jhumka", "earring", "brass", "jewellery"],
  jhumka: ["jhumka", "earring", "brass", "jewellery"],
  jhumki: ["jhumka", "earring", "brass", "jewellery"],
  ornament: ["jhumka", "earring", "brass", "jewellery"],
  nameplate: ["name", "plate", "personalised", "wooden", "entrance"],
  board: ["name", "plate", "wooden", "entrance"],
  sign: ["name", "plate", "personalised", "wooden"],
  door: ["name", "plate", "entrance", "wall", "hanging"],
  wood: ["wooden", "driftwood", "name", "plate"],
  wooden: ["wooden", "driftwood", "name", "plate"],
  custom: ["personalised", "name", "plate", "handwritten"],
  personalise: ["personalised", "name", "plate", "gift"],
  personalize: ["personalised", "name", "plate", "gift"],
  personalised: ["personalised", "name", "plate", "gift"],
  personalized: ["personalised", "name", "plate", "gift"],
  table: ["table", "runner", "jute", "cotton", "decor", "vase"],
  mat: ["runner", "table", "jute", "cotton"],
  cloth: ["runner", "table", "cotton", "jute"],
  combo: ["hamper", "gift", "curated"],
  kit: ["hamper", "gift", "curated"],
  box: ["hamper", "gift", "curated"],
  showpiece: ["vase", "terracotta", "decor", "hand-painted", "art", "macrame"],
  showcase: ["vase", "terracotta", "decor", "hand-painted", "art"],
  murti: ["decor", "handcrafted", "brass", "terracotta", "art"],
  idol: ["decor", "handcrafted", "brass", "terracotta", "art"],
  statue: ["decor", "handcrafted", "brass", "terracotta", "art"],
  figurine: ["decor", "handcrafted", "brass", "terracotta", "art"],
}

function editDistanceWithin(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    let rowMin = curr[0]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (curr[j] < rowMin) rowMin = curr[j]
    }
    if (rowMin > maxDist) return false
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]
  }
  return prev[b.length] <= maxDist
}

function hasFuzzyTokenMatch(token: string, wordsInProduct: string[]): boolean {
  if (token.length < 4) return false
  const maxDist = token.length >= 6 ? 2 : 1
  return wordsInProduct.some((w) => w.length >= 4 && editDistanceWithin(token, w, maxDist))
}

export function stemSearchWord(word: string): string {
  const w = word.toLowerCase().trim()
  if (w.length <= 2) return w
  if (w === "jewellery" || w === "jewelry") return "jewel"
  if (w === "decoration" || w === "decorations" || w === "decorative") return "decor"
  if (w === "gifting" || w === "gifts") return "gift"
  if (w === "candles") return "candle"
  if (w === "vases") return "vase"
  if (w === "boxes") return "box"
  if (w === "dishes") return "dish"
  if (w === "glasses") return "glass"
  if (w === "showpieces") return "showpiece"
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`
  if (/(?:shes|ches|xes|zes|ses)$/.test(w) && w.length > 4) return w.slice(0, -2)
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3)
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1)
  return w
}

export type ParsedSearchQuery = {
  raw: string
  hardTokens: { raw: string; stem: string }[]
  modifierTokens: string[]
  contextTokens: string[]
  hasGiftIntent: boolean
  hasMaleIntent: boolean
  hasFemaleIntent: boolean
  hasBudgetIntent: boolean
  minPrice: number | null
  maxPrice: number | null
  preferRangeMin: number | null
}

export function parseSearchQuery(input: string): ParsedSearchQuery {
  let text = input.toLowerCase().trim()
  let minPrice: number | null = null
  let maxPrice: number | null = null
  let preferRangeMin: number | null = null

  // 1. Range patterns: "between 500 and 700", "under 500 to 700", "500 to 700", "500 - 700", "500 se 700"
  const rangeMatch = text.match(
    /\b(under|below|upto|up\s+to|within|between|from|in|range|around)?\s*(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\s*(?:to|and|se|tak|-|–|—)\s*(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\b/i
  )
  if (rangeMatch) {
    const prefix = (rangeMatch[1] ?? "").toLowerCase().trim()
    const a = Number(rangeMatch[2])
    const b = Number(rangeMatch[3])
    const low = Math.min(a, b)
    const high = Math.max(a, b)
    if (prefix === "under" || prefix === "below" || prefix === "upto" || prefix.startsWith("up") || prefix === "within") {
      // e.g. "gifts under 500 to 700" -> allow everything <= 700 and boost [500, 700]
      minPrice = null
      maxPrice = high
      preferRangeMin = low
    } else {
      minPrice = low
      maxPrice = high
    }
    text = text.replace(rangeMatch[0], " ")
  } else {
    // 2. Prefix under/below/max: "under 500", "below ₹1000"
    const underPrefix = text.match(/\b(?:under|below|less\s+than|upto|up\s+to|max|within)\s*(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\b/i)
    if (underPrefix) {
      maxPrice = Number(underPrefix[1])
      text = text.replace(underPrefix[0], " ")
    }
    // 3. Postfix Hinglish/English under/max: "500 ke andar", "500 tak", "500 se kam", "500 or less"
    const underPostfix = text.match(
      /\b(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\s*(?:rs\.?|inr|rupees?|₹)?\s*(?:ke\s+andar|ke\s+neeche|ke\s+niche|se\s+kam|se\s+neeche|tak|or\s+less|and\s+below|max)\b/i
    )
    if (underPostfix) {
      maxPrice = Number(underPostfix[1])
      text = text.replace(underPostfix[0], " ")
    }
    // 4. Prefix over/above/min: "above 500", "over 1000"
    const overPrefix = text.match(/\b(?:above|over|more\s+than|min|starting\s+from|from)\s*(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\b/i)
    if (overPrefix) {
      minPrice = Number(overPrefix[1])
      text = text.replace(overPrefix[0], " ")
    }
    // 5. Postfix Hinglish/English over/min: "500 se upar", "500 se jyada", "500 plus"
    const overPostfix = text.match(
      /\b(?:rs\.?|inr|rupees?|₹)?\s*(\d+)\s*(?:rs\.?|inr|rupees?|₹)?\s*(?:se\s+upar|se\s+jyada|se\s+zyada|ke\s+upar|plus|\+|or\s+more|and\s+above)\b/i
    )
    if (overPostfix) {
      minPrice = Number(overPostfix[1])
      text = text.replace(overPostfix[0], " ")
    }
    // 6. Approx / currency price: "around 500", "₹500", "500 rs", "500 wala"
    const approxMatch = text.match(
      /\b(?:(?:around|near|approx|lagbhag|rs\.?|inr|rupees?|₹)\s*(\d+)|(\d+)\s*(?:rs\.?|inr|rupees?|₹|wala|wali|wale))\b/i
    )
    if (approxMatch && maxPrice === null && minPrice === null) {
      const target = Number(approxMatch[1] ?? approxMatch[2])
      if (target > 0) {
        maxPrice = Math.round(target * 1.2)
        preferRangeMin = Math.round(target * 0.7)
      }
      text = text.replace(approxMatch[0], " ")
    }
  }

  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 10)

  const hardTokens: { raw: string; stem: string }[] = []
  const modifierTokens: string[] = []
  const contextTokens: string[] = []
  let hasGiftIntent = false
  let hasMaleIntent = false
  let hasFemaleIntent = false
  let hasBudgetIntent = false

  for (const w of words) {
    if (/^\d+$/.test(w)) {
      const num = Number(w)
      if (num >= 50 && maxPrice === null) {
        maxPrice = num
      }
      continue
    }
    if (SEARCH_STOPWORDS.has(w)) continue
    if (BUDGET_INTENT_WORDS.has(w)) {
      hasBudgetIntent = true
      modifierTokens.push(w)
      continue
    }
    if (SOFT_MODIFIER_WORDS.has(w)) {
      modifierTokens.push(w)
      continue
    }
    if (MALE_CONTEXT_WORDS.has(w)) {
      hasMaleIntent = true
      contextTokens.push(w)
      continue
    }
    if (FEMALE_CONTEXT_WORDS.has(w)) {
      hasFemaleIntent = true
      contextTokens.push(w)
      continue
    }
    const stem = stemSearchWord(w)
    if (GIFT_INTENT_STEMS.has(stem)) {
      hasGiftIntent = true
      contextTokens.push(stem)
      continue
    }
    if (OCCASION_CONTEXT_WORDS.has(w) || OCCASION_CONTEXT_WORDS.has(stem)) {
      contextTokens.push(stem)
      continue
    }
    hardTokens.push({ raw: w, stem })
  }

  return {
    raw: input.trim().toLowerCase(),
    hardTokens,
    modifierTokens,
    contextTokens,
    hasGiftIntent,
    hasMaleIntent,
    hasFemaleIntent,
    hasBudgetIntent,
    minPrice,
    maxPrice,
    preferRangeMin,
  }
}

/**
 * Scores a product against a parsed search query.
 * Returns `null` if the product does not match; otherwise returns a numeric score (higher is better).
 */
export function scoreProductSearch(
  product: {
    name: string
    price: number
    category?: { name: string; slug: string } | null
    isFeatured?: boolean
    searchText: string
  },
  parsed: ParsedSearchQuery
): number | null {
  if (!parsed.raw) return 1
  if (parsed.minPrice !== null && product.price < parsed.minPrice) return null
  if (parsed.maxPrice !== null && product.price > parsed.maxPrice) return null

  const name = product.name.toLowerCase()
  const catName = (product.category?.name ?? "").toLowerCase()
  const text = product.searchText

  // If the user explicitly asked for men/him (and not women/her), filter out strictly feminine jewellery items unless explicitly searched
  if (parsed.hasMaleIntent && !parsed.hasFemaleIntent && parsed.hardTokens.length === 0) {
    if (FEMININE_ONLY_PATTERNS.test(name) || catName === "jewellery") {
      return null
    }
  }

  let score = 0

  // 1. Evaluate hard product tokens (e.g. "candle", "vase", "brass", "terracotta") with synonyms + typo tolerance
  if (parsed.hardTokens.length > 0) {
    let matchedHard = 0
    const productWords = text.replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean)
    for (const { raw, stem } of parsed.hardTokens) {
      const inName = name.includes(raw) || name.includes(stem)
      const inCat = catName.includes(raw) || catName.includes(stem)
      const inText = inName || inCat || text.includes(raw) || text.includes(stem)
      if (inText) {
        matchedHard++
        if (name.startsWith(raw) || name.startsWith(stem)) score += 60
        else if (inName) score += 45
        else if (inCat) score += 35
        else score += 20
        continue
      }
      // Check synonym expansion
      const syns = SEARCH_SYNONYMS[stem] ?? SEARCH_SYNONYMS[raw]
      if (syns && syns.some((s) => name.includes(s) || catName.includes(s) || text.includes(s))) {
        matchedHard++
        score += syns.some((s) => name.includes(s) || catName.includes(s)) ? 28 : 16
        continue
      }
      // Check typo-tolerant fuzzy match
      if (hasFuzzyTokenMatch(raw, productWords) || hasFuzzyTokenMatch(stem, productWords)) {
        matchedHard++
        score += 18
      }
    }
    // Require at least one hard token to match when hard tokens exist
    if (matchedHard === 0) return null
    // Bonus when all hard tokens match
    if (matchedHard === parsed.hardTokens.length) score += 50
  }

  // 2. Evaluate soft modifiers (colors, sizes, etc.)
  for (const mod of parsed.modifierTokens) {
    if (name.includes(mod)) score += 25
    else if (text.includes(mod)) score += 15
  }

  // 3. Evaluate gift / occasion / audience context tokens
  for (const ctx of parsed.contextTokens) {
    if (name.includes(ctx)) score += 30
    else if (catName.includes(ctx)) score += 25
    else if (text.includes(ctx)) score += 15
  }

  if (parsed.hasGiftIntent) {
    if (catName.includes("gift") || name.includes("gift") || name.includes("hamper")) {
      score += 40
    } else if (text.includes("gift") || text.includes("hamper") || text.includes("handcrafted") || text.includes("handmade") || text.includes("curated")) {
      score += 20
    } else if (parsed.hardTokens.length === 0) {
      // Giftable fallback for broad queries like "gifts for men" or "birthday gift"
      score += product.isFeatured ? 12 : 8
    }
  }

  if (parsed.hasFemaleIntent && (name.includes("women") || text.includes("women") || FEMININE_ONLY_PATTERNS.test(name))) {
    score += 18
  }

  if (parsed.hasMaleIntent && (name.includes("men") || text.includes("men"))) {
    score += 14
  }

  if (parsed.preferRangeMin !== null && product.price >= parsed.preferRangeMin) {
    score += 35
  }

  if (parsed.hasBudgetIntent) {
    score += Math.max(2, Math.round((2500 - product.price) / 80))
  }

  // 4. If query had no hard tokens (only gift/context/modifier/price intent like "gifts for men", "cheap gift", "under 1000")
  if (parsed.hardTokens.length === 0) {
    const hasPriceFilter = parsed.minPrice !== null || parsed.maxPrice !== null
    if (score === 0 && (parsed.contextTokens.length > 0 || parsed.modifierTokens.length > 0 || hasPriceFilter)) {
      score = product.isFeatured ? 10 : 5
    }
    if (score === 0) return null
  }

  if (product.isFeatured) score += 3
  return score
}

/**
 * Computes how far a product's price is from the requested price bounds (0 if inside bounds).
 */
export function priceDistanceToQuery(price: number, parsed: ParsedSearchQuery): number {
  if (parsed.minPrice !== null && price < parsed.minPrice) return parsed.minPrice - price
  if (parsed.maxPrice !== null && price > parsed.maxPrice) return price - parsed.maxPrice
  return 0
}

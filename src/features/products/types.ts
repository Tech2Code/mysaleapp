export type Category = {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string | null
  sort: number
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

export type Product = {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compareAtPrice: number | null
  images: string[]
  categoryId: string | null
  category: { name: string; slug: string } | null
  stock: number
  /** Unit parcel weight in grams (0 = light/standard item). Used for heavy-parcel courier slabs. */
  weightGrams: number
  /** Physical handling class (standard / fragile / oversized). */
  shippingClass: ShippingClass
  /** One or two sentences shown right under the price. */
  shortDescription: string | null
  /** Key selling points (max 6), shown as a checklist near the price. */
  highlights: string[]
  /** Material, size, weight… shown as a table. */
  specs: ProductSpec[]
  careInstructions: string | null
  isActive: boolean
  isFeatured: boolean
  seoTitle: string | null
  seoDescription: string | null
  createdAt: string
  updatedAt: string
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
  category: { name: string; slug: string } | null
  stock: number
  /** Added by migration 0046; optional so the app keeps working before it is applied. */
  weight_grams?: number | null
  shipping_class?: string | null
  short_description?: string | null
  highlights?: string[] | null
  specs?: ProductSpec[] | null
  care_instructions?: string | null
  is_active: boolean
  is_featured: boolean
  seo_title: string | null
  seo_description: string | null
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
}

export const PRODUCT_SELECT = "*, category:categories(name, slug)"

export function mapProduct(row: ProductRow): Product {
  const rawWeight = Number(row.weight_grams ?? 0)
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAtPrice: row.compare_at_price == null ? null : Number(row.compare_at_price),
    images: row.images ?? [],
    categoryId: row.category_id,
    category: row.category,
    stock: row.stock,
    weightGrams: Number.isFinite(rawWeight) && rawWeight > 0 ? Math.trunc(rawWeight) : 0,
    shippingClass: isShippingClass(row.shipping_class) ? row.shipping_class : "standard",
    shortDescription: row.short_description ?? null,
    highlights: row.highlights ?? [],
    specs: row.specs ?? [],
    careInstructions: row.care_instructions ?? null,
    isActive: row.is_active,
    isFeatured: row.is_featured,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
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
  }
}

/** Everything a product card needs. Keep client props this small: they are serialized into the page. */
export type ProductCardData = Pick<
  Product,
  "id" | "slug" | "name" | "price" | "compareAtPrice" | "images" | "stock" | "category"
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
  }
}

export function toListItem(p: Product): ProductListItem {
  return {
    ...toCardData(p),
    isFeatured: p.isFeatured,
    createdAt: p.createdAt,
    searchText: [p.name, p.shortDescription ?? "", p.description, p.category?.name ?? ""].join("\n").toLowerCase(),
  }
}

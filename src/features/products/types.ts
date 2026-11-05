export type Category = {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string | null
  sort: number
}

/**
 * An extra charge on a product, e.g. "Handling charge" ₹20. It is added ONCE per product in an order
 * (not multiplied by quantity). `reason` is a short explanation shown to the customer.
 */
export type ProductFee = { label: string; amount: number; reason?: string | null }

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
  fees: ProductFee[]
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
  /** Added by migration 0003; optional so the app keeps working before it is applied. */
  fees?: { label: string; amount: number | string; reason?: string | null }[] | null
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
    fees: (row.fees ?? []).map((f) => ({ label: f.label, amount: Number(f.amount), reason: f.reason ?? null })),
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

import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { getPublicSupabase } from "@/lib/supabase/public"
import { demoCategories, demoProducts } from "./demo-data"
import {
  mapCategory,
  mapProduct,
  PRODUCT_SELECT,
  type Category,
  type CategoryRow,
  type Product,
  type ProductListItem,
  type ProductRow,
  toListItem,
} from "./types"

/** Cache tags — admin mutations call updateTag() with these. */
export const CACHE_TAGS = {
  products: "products",
  categories: "categories",
} as const

/**
 * Public catalogue reads. The catalogue is small (<100 items), so we cache the
 * whole active list once and derive everything else from it in memory.
 * The cache is refreshed instantly whenever an admin saves a product.
 */
export async function getActiveProducts(): Promise<Product[]> {
  "use cache"
  // Instant updates come from updateTag(CACHE_TAGS.products) on orders, cancellations, returns and admin saves.
  // A 5-minute background revalidate also picks up pg_cron unpaid-order expiries without expiring the cache synchronously.
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 })
  cacheTag(CACHE_TAGS.products)

  const supabase = getPublicSupabase()
  if (!supabase) return demoProducts

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>()

  if (error) throw new Error(`Failed to load products: ${error.message}`)
  return data.map(mapProduct)
}

export async function getCategories(): Promise<Category[]> {
  "use cache"
  cacheLife("days")
  cacheTag(CACHE_TAGS.categories)

  const supabase = getPublicSupabase()
  if (!supabase) return demoCategories

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort", { ascending: true })
    .returns<CategoryRow[]>()

  if (error) throw new Error(`Failed to load categories: ${error.message}`)
  return data.map(mapCategory)
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const products = await getActiveProducts()
  const featured = products.filter((p) => p.isFeatured)
  return (featured.length ? featured : products).slice(0, limit)
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await getActiveProducts()
  return products.find((p) => p.slug === slug) ?? null
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const categories = await getCategories()
  return categories.find((c) => c.slug === slug) ?? null
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const products = await getActiveProducts()
  return products.filter((p) => p.category?.slug === slug)
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const products = await getActiveProducts()
  const sameCategory = products.filter(
    (p) => p.id !== product.id && p.categoryId === product.categoryId
  )
  const others = products.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId)
  return [...sameCategory, ...others].slice(0, limit)
}

/** Only categories that actually contain active products, for navigation. */
export async function getCategoriesWithCounts(): Promise<(Category & { count: number })[]> {
  "use cache"
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 })
  cacheTag(CACHE_TAGS.products, CACHE_TAGS.categories)

  const [categories, products] = await Promise.all([getCategories(), getActiveProducts()])
  return categories
    .map((c) => {
      const inCategory = products.filter((p) => p.categoryId === c.id)
      // No category photo? Use the cover of its first product with a photo, so cards are never blank.
      const cover = c.imageUrl ?? inCategory.find((p) => p.images[0])?.images[0] ?? null
      return { ...c, imageUrl: cover, count: inCategory.length }
    })
    .filter((c) => c.count > 0)
}

/** Slim projection for the client shop browser (no descriptions/SEO/fees in the page payload). */
export async function getProductListItems(): Promise<ProductListItem[]> {
  "use cache"
  cacheLife({ stale: 300, revalidate: 300, expire: 86400 })
  cacheTag(CACHE_TAGS.products)

  const products = await getActiveProducts()
  return products.map(toListItem)
}

export type Category = {
  id: string
  name: string
  slug: string
  description: string
  imageUrl: string | null
  sort: number
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
  category: { name: string; slug: string } | null
  stock: number
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

import type { MetadataRoute } from "next"
import { getActiveProducts, getCategoriesWithCounts } from "@/features/products/queries"
import { absoluteUrl } from "@/lib/seo"

/** Auto-generated from the live catalogue; refreshed whenever products change. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getActiveProducts(), getCategoriesWithCounts()])

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.5 },
    { url: absoluteUrl("/track"), changeFrequency: "yearly", priority: 0.3 },
  ]

  return [
    ...staticPages,
    ...categories.map((c) => ({
      url: absoluteUrl(`/category/${c.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((p) => ({
      url: absoluteUrl(`/products/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: p.images.slice(0, 3),
    })),
  ]
}

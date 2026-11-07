import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Skeletonize } from "@/components/shared/skeletonize"
import { CategoryView } from "@/components/store/category-view"
import { JsonLd } from "@/components/shared/json-ld"
import { placeholderCards, placeholderCategory } from "@/features/products/placeholders"
import {
  getCategories,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export async function generateStaticParams() {
  const categories = await getCategories()
  // At least one param is required for build-time validation with Cache Components.
  return categories.length ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "all" }]
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const [category, shop] = await Promise.all([getCategoryBySlug(slug), getStoreSettings()])
  if (!category) return { title: "Category not found", robots: { index: false } }
  return pageMetadata(shop, {
    title: category.name,
    description:
      category.description ||
      `Shop ${category.name.toLowerCase()} at ${shop.shopName}. ${shop.tagline}. Pay securely by UPI.`,
    path: `/category/${category.slug}`,
  })
}

// Reading `params` inside <Suspense> keeps navigation instant (see products/[slug]).
export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense
      fallback={
        <Skeletonize>
          <CategoryView category={placeholderCategory()} products={placeholderCards(8)} />
        </Skeletonize>
      }
    >
      <CategoryContent params={params} />
    </Suspense>
  )
}

async function CategoryContent({ params }: Pick<PageProps<"/category/[slug]">, "params">) {
  const { slug } = await params
  const [category, products, shop] = await Promise.all([
    getCategoryBySlug(slug),
    getProductsByCategory(slug),
    getStoreSettings(),
  ])
  if (!category) notFound()

  return (
    <>
      <CategoryView category={category} products={products} />
      <JsonLd
        data={[
          itemListJsonLd(products, shop, category),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop", path: "/products" },
            { name: category.name, path: `/category/${category.slug}` },
          ]),
        ]}
      />
    </>
  )
}

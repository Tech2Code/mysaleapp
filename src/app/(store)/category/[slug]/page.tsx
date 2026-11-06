import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CategorySkeleton } from "@/components/store/store-skeletons"
import { JsonLd } from "@/components/shared/json-ld"
import { PageHeader } from "@/components/store/page-header"
import { ProductGrid } from "@/components/store/product-grid"
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
    title: `Handmade ${category.name}`,
    description:
      category.description ||
      `Shop handmade ${category.name.toLowerCase()} at ${shop.shopName}. Crafted by artisans, paid securely by UPI.`,
    path: `/category/${category.slug}`,
  })
}

// Reading `params` inside <Suspense> keeps navigation instant (see products/[slug]).
export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
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
      <PageHeader
        title={category.name}
        description={category.description}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: category.name }]}
      />
      <div data-ui="page:/category/[slug]#CategoryContent/div" className="container-page pt-4 sm:pt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p data-ui="page:/category/[slug]#CategoryContent/p" className="rounded-3xl border border-dashed py-14 sm:py-20 text-center text-muted-foreground">
            New pieces for this collection are being crafted. Check back soon!
          </p>
        )}
      </div>
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

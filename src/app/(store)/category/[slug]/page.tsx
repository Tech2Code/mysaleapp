import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
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

function CategorySkeleton() {
  return (
    <div data-ui="page:/category/[slug]#CategorySkeleton" aria-hidden>
      <div data-ui="page:/category/[slug]#CategorySkeleton/div" className="bg-hero">
        <div data-ui="page:/category/[slug]#CategorySkeleton/div-2" className="container-page space-y-4 py-14">
          <Skeleton data-ui="page:/category/[slug]#CategorySkeleton/Skeleton" className="h-4 w-48" />
          <Skeleton data-ui="page:/category/[slug]#CategorySkeleton/Skeleton-2" className="h-12 w-72" />
        </div>
      </div>
      <div data-ui="page:/category/[slug]#CategorySkeleton/div-grid" className="container-page grid grid-cols-2 gap-6 pt-4 sm:pt-6 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton data-ui="page:/category/[slug]#CategorySkeleton/Skeleton-3" key={i} className="aspect-4/5 rounded-2xl" />
        ))}
      </div>
    </div>
  )
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

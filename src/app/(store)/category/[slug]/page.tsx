import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/shared/json-ld"
import { PageHeader } from "@/components/store/page-header"
import { ProductGrid } from "@/components/store/product-grid"
import { siteConfig } from "@/config/site"
import {
  getCategories,
  getCategoryBySlug,
  getProductsByCategory,
} from "@/features/products/queries"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export async function generateStaticParams() {
  const categories = await getCategories()
  // At least one param is required for build-time validation with Cache Components.
  return categories.length ? categories.map((c) => ({ slug: c.slug })) : [{ slug: "all" }]
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  if (!category) return { title: "Category not found", robots: { index: false } }
  return pageMetadata({
    title: `Handmade ${category.name}`,
    description:
      category.description ||
      `Shop handmade ${category.name.toLowerCase()} at ${siteConfig.name}. Crafted by artisans, ordered on WhatsApp.`,
    path: `/category/${category.slug}`,
  })
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params
  const [category, products] = await Promise.all([getCategoryBySlug(slug), getProductsByCategory(slug)])
  if (!category) notFound()

  return (
    <>
      <PageHeader
        title={category.name}
        description={category.description}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: category.name }]}
      />
      <div className="container-page pt-10">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className="rounded-3xl border border-dashed py-20 text-center text-muted-foreground">
            New pieces for this collection are being crafted. Check back soon!
          </p>
        )}
      </div>
      <JsonLd
        data={[
          itemListJsonLd(products, category),
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

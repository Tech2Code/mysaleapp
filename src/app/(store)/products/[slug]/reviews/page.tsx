import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { JsonLd } from "@/components/shared/json-ld"
import { Skeletonize } from "@/components/shared/skeletonize"
import { ProductReviewsPageView } from "@/components/store/product-actions"
import { productCrumbs } from "@/components/store/product-detail-view"
import { placeholderProduct, placeholderReviews } from "@/features/products/placeholders"
import { getActiveProducts, getProductBySlug, getProductReviews } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo"

export async function generateStaticParams() {
  const products = await getActiveProducts()
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "placeholder" }]
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]/reviews">): Promise<Metadata> {
  const { slug } = await params
  const [product, shop] = await Promise.all([getProductBySlug(slug), getStoreSettings()])
  if (!product) return { title: "Product not found", robots: { index: false } }

  return pageMetadata(shop, {
    title: `Customer Reviews — ${product.name}`,
    description: `Read verified customer reviews and ratings for ${product.name} at ${shop.shopName}.`,
    path: `/products/${product.slug}/reviews`,
    images: product.images.length ? product.images.slice(0, 1) : undefined,
  })
}

export default function ProductReviewsPage({ params }: PageProps<"/products/[slug]/reviews">) {
  return (
    <Suspense
      fallback={
        <Skeletonize>
          <ProductReviewsPageView product={placeholderProduct()} reviews={placeholderReviews(4)} />
        </Skeletonize>
      }
    >
      <ProductReviewsContent params={params} />
    </Suspense>
  )
}

async function ProductReviewsContent({ params }: Pick<PageProps<"/products/[slug]/reviews">, "params">) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const reviews = await getProductReviews(product.id)
  const crumbs = [
    ...productCrumbs(product).map((c) => ({ name: c.name, path: c.href ?? `/products/${product.slug}` })),
    { name: "Reviews", path: `/products/${product.slug}/reviews` },
  ]

  return (
    <>
      <ProductReviewsPageView product={product} reviews={reviews} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </>
  )
}

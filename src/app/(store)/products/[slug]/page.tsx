import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Skeletonize } from "@/components/shared/skeletonize"
import { ProductDetailView, productCrumbs } from "@/components/store/product-detail-view"
import { JsonLd } from "@/components/shared/json-ld"
import { placeholderCards, placeholderProduct } from "@/features/products/placeholders"
import { getActiveProducts, getProductBySlug, getRelatedProducts } from "@/features/products/queries"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"
import { getStoreSettings } from "@/features/settings/queries"
import { formatPrice } from "@/lib/format"
import { breadcrumbJsonLd, pageMetadata, productJsonLd } from "@/lib/seo"

export async function generateStaticParams() {
  const products = await getActiveProducts()
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "placeholder" }]
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const [product, shop] = await Promise.all([getProductBySlug(slug), getStoreSettings()])
  if (!product) return { title: "Product not found", robots: { index: false } }

  const description =
    product.seoDescription ||
    `${product.description.slice(0, 140)}${product.description.length > 140 ? "…" : ""}`
  return pageMetadata(shop, {
    title: product.seoTitle || `${product.name} — ${formatPrice(product.price)}`,
    description,
    path: `/products/${product.slug}`,
    images: product.images.length ? product.images.slice(0, 1) : undefined,
  })
}

// The page itself only forwards the `params` promise. Reading it inside <Suspense>
// lets Next.js show this shell instantly while the product streams in.
export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense
      fallback={
        <Skeletonize>
          <ProductDetailView product={placeholderProduct()} related={placeholderCards(4)} settings={DEFAULT_SETTINGS} />
        </Skeletonize>
      }
    >
      <ProductDetails params={params} />
    </Suspense>
  )
}

async function ProductDetails({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const [related, settings] = await Promise.all([getRelatedProducts(product), getStoreSettings()])
  const crumbs = productCrumbs(product)

  return (
    <>
      <ProductDetailView product={product} related={related} settings={settings} />
      <JsonLd
        data={[
          productJsonLd(product, settings),
          breadcrumbJsonLd(crumbs.map((c) => ({ name: c.name, path: c.href ?? `/products/${product.slug}` }))),
        ]}
      />
    </>
  )
}

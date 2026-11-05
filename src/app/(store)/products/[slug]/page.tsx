import { HandHeartIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { JsonLd } from "@/components/shared/json-ld"
import { FadeIn } from "@/components/shared/motion"
import { Breadcrumbs } from "@/components/store/page-header"
import { ProductActions } from "@/components/store/product-actions"
import { ProductGallery } from "@/components/store/product-gallery"
import { ProductGrid } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { siteConfig } from "@/config/site"
import { getActiveProducts, getProductBySlug, getRelatedProducts } from "@/features/products/queries"
import { discountPercent, formatPrice } from "@/lib/format"
import { breadcrumbJsonLd, pageMetadata, productJsonLd } from "@/lib/seo"

export async function generateStaticParams() {
  const products = await getActiveProducts()
  return products.length ? products.map((p) => ({ slug: p.slug })) : [{ slug: "placeholder" }]
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: "Product not found", robots: { index: false } }

  const description =
    product.seoDescription ||
    `${product.description.slice(0, 140)}${product.description.length > 140 ? "…" : ""}`
  return pageMetadata({
    title: product.seoTitle || `${product.name} — ${formatPrice(product.price)}`,
    description,
    path: `/products/${product.slug}`,
    images: product.images.length ? product.images.slice(0, 1) : undefined,
  })
}

const perks = [
  { icon: HandHeartIcon, text: "Handmade by skilled artisans" },
  { icon: TruckIcon, text: `Free delivery above ${formatPrice(siteConfig.freeShippingAbove)}` },
  { icon: ShieldCheckIcon, text: "Pay after confirming on WhatsApp" },
]

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const related = await getRelatedProducts(product)
  const off = discountPercent(product.price, product.compareAtPrice)
  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category ? [{ name: product.category.name, href: `/category/${product.category.slug}` }] : []),
    { name: product.name },
  ]

  return (
    <>
      <div className="container-page pt-6 pb-4">
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
        <FadeIn y={16}>
          <ProductGallery images={product.images} name={product.name} />
        </FadeIn>

        <FadeIn y={16} delay={0.1} className="lg:sticky lg:top-24 lg:self-start">
          {product.category && (
            <p className="text-sm font-semibold tracking-widest text-primary uppercase">{product.category.name}</p>
          )}
          <h1 className="mt-2 text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">{product.name}</h1>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="font-heading text-3xl font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
            {off && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                Save {off}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

          <div className="mt-8">
            <ProductActions product={product} />
          </div>

          <ul className="mt-8 grid gap-3 rounded-3xl border bg-card p-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {perks.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <section className="mt-8" aria-labelledby="desc-title">
            <h2 id="desc-title" className="text-xl font-semibold">
              About this piece
            </h2>
            <div className="mt-3 space-y-3 leading-relaxed whitespace-pre-line text-muted-foreground">
              {product.description}
            </div>
          </section>
        </FadeIn>
      </div>

      {related.length > 0 && (
        <section className="container-page mt-24" aria-labelledby="related-title">
          <SectionHeading id="related-title" eyebrow="You may also like" title="More handmade picks" href="/products" />
          <ProductGrid products={related} priorityCount={0} />
        </section>
      )}

      <JsonLd
        data={[
          productJsonLd(product),
          breadcrumbJsonLd(
            crumbs.map((c) => ({ name: c.name, path: c.href ?? `/products/${product.slug}` }))
          ),
        ]}
      />
    </>
  )
}

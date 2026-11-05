import { CheckCircle2Icon, HandHeartIcon, InfoIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { JsonLd } from "@/components/shared/json-ld"
import { Accordion, AccordionItem } from "@/components/shared/accordion"
import { FadeIn } from "@/components/shared/motion"
import { ReadMore } from "@/components/shared/read-more"
import { Breadcrumbs } from "@/components/store/page-header"
import { ProductActions } from "@/components/store/product-actions"
import { ProductGallery } from "@/components/store/product-gallery"
import { ProductGrid } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { getActiveProducts, getProductBySlug, getRelatedProducts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { discountPercent, formatPrice } from "@/lib/format"
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

function ProductSkeleton() {
  return (
    <div data-ui="page:/products/[slug]#ProductSkeleton" className="container-page grid gap-10 pt-10 lg:grid-cols-2 lg:gap-16" aria-hidden>
      <Skeleton data-ui="page:/products/[slug]#ProductSkeleton/Skeleton" className="aspect-4/5 rounded-3xl" />
      <div data-ui="page:/products/[slug]#ProductSkeleton/div" className="space-y-4">
        <Skeleton data-ui="page:/products/[slug]#ProductSkeleton/Skeleton-2" className="h-4 w-24" />
        <Skeleton data-ui="page:/products/[slug]#ProductSkeleton/Skeleton-3" className="h-12 w-3/4" />
        <Skeleton data-ui="page:/products/[slug]#ProductSkeleton/Skeleton-4" className="h-8 w-40" />
        <Skeleton data-ui="page:/products/[slug]#ProductSkeleton/Skeleton-5" className="h-40 rounded-3xl" />
      </div>
    </div>
  )
}

// The page itself only forwards the `params` promise. Reading it inside <Suspense>
// lets Next.js show this shell instantly while the product streams in.
export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetails params={params} />
    </Suspense>
  )
}

async function ProductDetails({ params }: Pick<PageProps<"/products/[slug]">, "params">) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const [related, settings] = await Promise.all([getRelatedProducts(product), getStoreSettings()])
  const off = discountPercent(product.price, product.compareAtPrice)
  const perks = [
    { icon: HandHeartIcon, text: "Handmade by skilled artisans" },
    {
      icon: TruckIcon,
      text:
        settings.freeDeliveryAbove > 0
          ? `Free delivery above ${formatPrice(settings.freeDeliveryAbove)}`
          : `Delivery ${formatPrice(settings.deliveryFee)} per order`,
    },
    { icon: ShieldCheckIcon, text: "Pay securely by UPI · No cash on delivery" },
  ]
  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category ? [{ name: product.category.name, href: `/category/${product.category.slug}` }] : []),
    { name: product.name },
  ]

  const summary =
    product.shortDescription ||
    (product.description.length > 170 ? `${product.description.slice(0, 167).trimEnd()}…` : product.description)
  const freeDelivery =
    settings.freeDeliveryAbove > 0
      ? `Free delivery on orders above ${formatPrice(settings.freeDeliveryAbove)}. Otherwise a flat ${formatPrice(settings.deliveryFee)}.`
      : `Delivery is a flat ${formatPrice(settings.deliveryFee)} per order.`

  return (
    <>
      <div data-ui="page:/products/[slug]#ProductDetails/div" className="container-page pt-6 pb-4">
        <Breadcrumbs items={crumbs} />
      </div>

      <div data-ui="page:/products/[slug]#ProductDetails/div-grid" className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
        <FadeIn y={16} className="lg:sticky-store lg:self-start">
          <ProductGallery images={product.images} name={product.name} />

          <ul data-ui="page:/products/[slug]#ProductDetails/ul-grid" className="mt-6 grid grid-cols-3 gap-2 rounded-3xl border bg-card p-3 sm:gap-3 sm:p-5">
            {perks.map((p) => (
              <li data-ui="page:/products/[slug]#ProductDetails/li-flex" key={p.text} className="flex flex-col items-center gap-2 text-center text-xs/snug  sm:text-sm">
                <span data-ui="page:/products/[slug]#ProductDetails/span-grid" className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon data-ui="page:/products/[slug]#ProductDetails/p.icon" className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </FadeIn>

        <FadeIn y={16} delay={0.1} className="min-w-0">
          {product.category && (
            <p data-ui="page:/products/[slug]#ProductDetails/p" className="text-sm font-semibold tracking-widest text-primary uppercase">{product.category.name}</p>
          )}
          <h1 data-ui="page:/products/[slug]#ProductDetails/h1" className="mt-2 text-3xl/tight  font-semibold sm:text-4xl lg:text-5xl">{product.name}</h1>

          <div data-ui="page:/products/[slug]#ProductDetails/div-flex" className="mt-5 flex flex-wrap items-baseline gap-3">
            <span data-ui="page:/products/[slug]#ProductDetails/span" className="font-heading text-3xl font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span data-ui="page:/products/[slug]#ProductDetails/span-2" className="text-lg text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
            {off && (
              <span data-ui="page:/products/[slug]#ProductDetails/span-3" className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">Save {off}%</span>
            )}
          </div>
          <p data-ui="page:/products/[slug]#ProductDetails/p-2" className="mt-1 text-xs text-muted-foreground">Inclusive of all taxes</p>

          {summary && <p data-ui="page:/products/[slug]#ProductDetails/p-3" className="mt-5 leading-relaxed text-muted-foreground">{summary}</p>}

          {product.highlights.length > 0 && (
            <ul data-ui="page:/products/[slug]#ProductDetails/ul-highlights" className="mt-5 space-y-2.5" aria-label="Highlights">
              {product.highlights.map((h) => (
                <li data-ui="page:/products/[slug]#ProductDetails/li-flex-2" key={h} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2Icon className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {product.fees.length > 0 && (
            <div data-ui="page:/products/[slug]#ProductDetails/div-2" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <p data-ui="page:/products/[slug]#ProductDetails/p-flex" className="flex items-center gap-2 font-semibold">
                <InfoIcon className="size-4" aria-hidden /> Extra charge on this product
              </p>
              <ul data-ui="page:/products/[slug]#ProductDetails/ul" className="mt-2 space-y-2">
                {product.fees.map((f) => (
                  <li data-ui="page:/products/[slug]#ProductDetails/li" key={f.label}>
                    <span data-ui="page:/products/[slug]#ProductDetails/span-4" className="font-medium">
                      {f.label}: {formatPrice(f.amount)}
                    </span>
                    {f.reason && <span data-ui="page:/products/[slug]#ProductDetails/span-5" className="block text-muted-foreground">{f.reason}</span>}
                  </li>
                ))}
              </ul>
              <p data-ui="page:/products/[slug]#ProductDetails/p-4" className="mt-2 text-xs text-muted-foreground">Added once per order for this product, whatever the quantity. Shown separately at checkout.</p>
            </div>
          )}

          <div data-ui="page:/products/[slug]#ProductDetails/div-3" className="mt-8">
            <ProductActions product={product} />
          </div>

        </FadeIn>
      </div>

      {/* ---------------------------------------------------------------- full details */}
      <section data-ui="page:/products/[slug]#ProductDetails/section-grid" className="container-page mt-10 sm:mt-16 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16" aria-labelledby="details-title">
        <div data-ui="page:/products/[slug]#ProductDetails/div-4" className="min-w-0">
          <h2 data-ui="page:/products/[slug]#ProductDetails/h2-about-this-piece" id="details-title" className="text-2xl font-semibold">
            About this piece
          </h2>
          <ReadMore length={product.description.length} className="mt-4">
            <div data-ui="page:/products/[slug]#ProductDetails/div-5" className="space-y-3 leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</div>
          </ReadMore>
        </div>

        <div data-ui="page:/products/[slug]#ProductDetails/div-6" className="min-w-0 space-y-6">
          {product.specs.length > 0 && (
            <div data-ui="page:/products/[slug]#ProductDetails/div-7">
              <h2 data-ui="page:/products/[slug]#ProductDetails/h2-details" className="text-2xl font-semibold">Details</h2>
              <dl data-ui="page:/products/[slug]#ProductDetails/dl" className="mt-4 divide-y rounded-3xl border bg-card px-5 sm:px-6">
                {product.specs.map((s) => (
                  <div data-ui="page:/products/[slug]#ProductDetails/div-grid-2" key={s.label} className="grid grid-cols-[8rem_1fr] gap-4 py-3 text-sm sm:grid-cols-[10rem_1fr]">
                    <dt data-ui="page:/products/[slug]#ProductDetails/dt" className="text-muted-foreground">{s.label}</dt>
                    <dd data-ui="page:/products/[slug]#ProductDetails/dd" className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <Accordion>
            {product.careInstructions && <AccordionItem title="Care instructions">{product.careInstructions}</AccordionItem>}
            <AccordionItem title="Delivery">{freeDelivery} We pack every order by hand and share the courier and tracking details with you once it ships.</AccordionItem>
            <AccordionItem title="Payment">
              Pay securely by UPI right after you place the order, then enter the UTR / reference number. We confirm your order once the
              payment is verified. Cash on delivery isn&apos;t available.
            </AccordionItem>
            <AccordionItem title="Handmade, so no two are identical">
              Each piece is made by hand in small batches, so there can be small differences in colour, texture and size from the photos.
              That is part of the charm.
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {related.length > 0 && (
        <section data-ui="page:/products/[slug]#ProductDetails/section" className="container-page mt-16 sm:mt-24" aria-labelledby="related-title">
          <SectionHeading id="related-title" eyebrow="You may also like" title="More handmade picks" href="/products" />
          <ProductGrid products={related} priorityCount={0} />
        </section>
      )}

      <JsonLd
        data={[
          productJsonLd(product, settings),
          breadcrumbJsonLd(
            crumbs.map((c) => ({ name: c.name, path: c.href ?? `/products/${product.slug}` }))
          ),
        ]}
      />
    </>
  )
}

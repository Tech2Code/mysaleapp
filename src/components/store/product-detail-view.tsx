import { CheckCircle2Icon, HandHeartIcon, InfoIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import { Accordion, AccordionItem } from "@/components/shared/accordion"
import { FadeIn } from "@/components/shared/motion"
import { ReadMore } from "@/components/shared/read-more"
import { Breadcrumbs } from "@/components/store/page-header"
import { ProductActions } from "@/components/store/product-actions"
import { ProductGallery } from "@/components/store/product-gallery"
import { ProductGrid } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { describeProductSurcharges } from "@/features/orders/pricing"
import type { Product, ProductCardData } from "@/features/products/types"
import { priceNote } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { discountPercent, formatPrice } from "@/lib/format"

/** Breadcrumb trail (also used for the page's structured data). */
export function productCrumbs(product: Pick<Product, "name" | "category">): { name: string; href?: string }[] {
  return [
    { name: "Home", href: "/" },
    ...(product.category ? [{ name: product.category.name, href: `/category/${product.category.slug}` }] : []),
    { name: product.name },
  ]
}

/**
 * The product page body (no JSON-LD). The page passes real data; loading.tsx passes placeholders inside <Skeletonize>.
 *
 * Layout (the Shopify / Amazon / Apple pattern): the photos stay pinned on the left while ONE long column on
 * the right scrolls — buy box, perks, about, specs, FAQ. Because the photos follow the reader, the left side
 * never shows a gap, whatever the text length. On phones it is a single column.
 */
export function ProductDetailView({ product, related, settings }: { product: Product; related: ProductCardData[]; settings: StoreSettings }) {
  const off = discountPercent(product.price, product.compareAtPrice)
  const taxNote = priceNote(settings)
  const surcharges = describeProductSurcharges(product, settings)
  const perks = [
    { icon: HandHeartIcon, text: settings.highlightLine },
    {
      icon: TruckIcon,
      text:
        settings.freeDeliveryAbove > 0
          ? `Free delivery above ${formatPrice(settings.freeDeliveryAbove)}`
          : `Delivery ${formatPrice(settings.deliveryFee)} per order`,
    },
    { icon: ShieldCheckIcon, text: "Pay securely by UPI · No cash on delivery" },
  ]
  const crumbs = productCrumbs(product)

  const summary =
    product.shortDescription ||
    (product.description.length > 170 ? `${product.description.slice(0, 167).trimEnd()}…` : product.description)
  const freeDelivery =
    settings.freeDeliveryAbove > 0
      ? `Free delivery on orders above ${formatPrice(settings.freeDeliveryAbove)}. Otherwise a flat ${formatPrice(settings.deliveryFee)}.`
      : `Delivery is a flat ${formatPrice(settings.deliveryFee)} per order.`

  return (
    <>
      <div data-ui="store/ProductDetailView/div" className="container-page pt-6 pb-4">
        <Breadcrumbs items={crumbs} />
      </div>

      <div data-ui="store/ProductDetailView/div-grid" className="container-page grid gap-6 sm:gap-8 lg:grid-cols-2 lg:items-start lg:gap-16">
        <FadeIn y={16} className="min-w-0 lg:sticky-store">
          <ProductGallery images={product.images} name={product.name} />
        </FadeIn>

        <FadeIn y={16} delay={0.1} className="min-w-0">
          {product.category && (
            <p data-ui="store/ProductDetailView/p" className="text-sm font-semibold tracking-widest text-primary uppercase">{product.category.name}</p>
          )}
          <h1 data-ui="store/ProductDetailView/h1" className="mt-2 text-3xl/tight  font-semibold sm:text-4xl lg:text-5xl">{product.name}</h1>

          <div data-ui="store/ProductDetailView/div-flex" className="mt-3 flex flex-wrap items-baseline gap-3 sm:mt-5">
            <span data-ui="store/ProductDetailView/span" className="font-heading text-3xl font-semibold">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span data-ui="store/ProductDetailView/span-2" className="text-lg text-muted-foreground line-through">{formatPrice(product.compareAtPrice)}</span>
            )}
            {off && (
              <span data-ui="store/ProductDetailView/span-3" className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">Save {off}%</span>
            )}
          </div>
          {taxNote && <p data-ui="store/ProductDetailView/p-2" className="mt-1 text-xs text-muted-foreground">{taxNote}</p>}

          {summary && <p data-ui="store/ProductDetailView/p-3" className="mt-3 leading-relaxed text-muted-foreground sm:mt-5">{summary}</p>}

          {product.highlights.length > 0 && (
            <ul data-ui="store/ProductDetailView/ul-highlights" className="mt-4 space-y-2 sm:mt-5 sm:space-y-2.5" aria-label="Highlights">
              {product.highlights.map((h, idx) => (
                <li data-ui="store/ProductDetailView/li-flex" key={`${idx}-${h}`} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2Icon className="mt-0.5 size-4.5 shrink-0 text-success" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {surcharges.length > 0 && (
            <div data-ui="store/ProductDetailView/div-2" className="mt-4 rounded-2xl border border-amber-200 sm:mt-5 bg-amber-50/70 p-4 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
              <p data-ui="store/ProductDetailView/p-flex" className="flex items-center gap-2 font-semibold">
                <InfoIcon className="size-4" aria-hidden /> Special shipping &amp; handling
              </p>
              <ul data-ui="store/ProductDetailView/ul" className="mt-2 space-y-2">
                {surcharges.map((f, idx) => (
                  <li data-ui="store/ProductDetailView/li" key={`${idx}-${f.label}`}>
                    <span data-ui="store/ProductDetailView/span-4" className="font-medium">
                      {f.label}: {formatPrice(f.amount)}
                    </span>
                    <span data-ui="store/ProductDetailView/span-5" className="block text-muted-foreground">{f.reason}</span>
                  </li>
                ))}
              </ul>
              <p data-ui="store/ProductDetailView/p-4" className="mt-2 text-xs text-muted-foreground">Calculated across your whole order at checkout, never compounded per item.</p>
            </div>
          )}

          <div data-ui="store/ProductDetailView/div-3" className="mt-5 sm:mt-8">
            <ProductActions product={product} />
          </div>

          {/* Trust row: compact, directly under the buttons (where the doubt is). */}
          <ul data-ui="store/ProductDetailView/ul-2" className="mt-4 divide-y rounded-2xl border bg-card px-4 text-sm sm:mt-6">
            {perks.map((p) => (
              <li data-ui="store/ProductDetailView/li-flex-2" key={p.text} className="flex items-center gap-3 py-2.5 sm:py-3">
                <span data-ui="store/ProductDetailView/span-grid" className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon data-ui="store/ProductDetailView/p.icon" className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <section data-ui="store/ProductDetailView/section" className="mt-7 border-t pt-6 sm:mt-10 sm:pt-8" aria-labelledby="details-title">
            <h2 data-ui="store/ProductDetailView/h2-about-this-piece" id="details-title" className="text-xl font-semibold sm:text-2xl">
              About this piece
            </h2>
            <ReadMore length={product.description.length} className="mt-3">
              <div data-ui="store/ProductDetailView/div-4" className="space-y-3 leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</div>
            </ReadMore>
          </section>

          {product.specs.length > 0 && (
            <section data-ui="store/ProductDetailView/section-2" className="mt-6 sm:mt-8" aria-labelledby="specs-title">
              <h2 data-ui="store/ProductDetailView/h2-details" id="specs-title" className="text-xl font-semibold sm:text-2xl">Details</h2>
              <dl data-ui="store/ProductDetailView/dl" className="mt-3 divide-y rounded-2xl border bg-card px-4 sm:px-5">
                {product.specs.map((s, idx) => (
                  <div data-ui="store/ProductDetailView/div-grid-2" key={`${idx}-${s.label}`} className="grid grid-cols-[7rem_1fr] gap-4 py-3 text-sm sm:grid-cols-[9rem_1fr]">
                    <dt data-ui="store/ProductDetailView/dt" className="text-muted-foreground">{s.label}</dt>
                    <dd data-ui="store/ProductDetailView/dd" className="font-medium">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div data-ui="store/ProductDetailView/div-5" className="mt-6 sm:mt-8">
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
        </FadeIn>
      </div>

      {related.length > 0 && (
        <section data-ui="store/ProductDetailView/section-3" className="container-page mt-12 sm:mt-24" aria-labelledby="related-title">
          <SectionHeading id="related-title" eyebrow="You may also like" title="More you may like" href="/products" />
          <ProductGrid products={related} priorityCount={0} />
        </section>
      )}

    </>
  )
}

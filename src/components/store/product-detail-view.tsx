import { CheckCircle2Icon, HandHeartIcon, InfoIcon, RotateCcwIcon, ShieldCheckIcon, TruckIcon } from "lucide-react"
import { Accordion, AccordionItem } from "@/components/shared/accordion"
import { FadeIn } from "@/components/shared/motion"
import { ReadMore } from "@/components/shared/read-more"
import { Breadcrumbs } from "@/components/store/page-header"
import { ProductActions, ProductLivePriceHeader, ProductReviewsSection, ProductVariantProvider } from "@/components/store/product-actions"
import { ProductGallery } from "@/components/store/product-gallery"
import { ProductCarousel } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { describeProductSurcharges } from "@/features/orders/pricing"
import type { Product, ProductCardData, ProductReview } from "@/features/products/types"
import { priceNote } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatPrice } from "@/lib/format"
import styles from "./product-detail.module.css"

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
export function ProductDetailView({
  product,
  related,
  settings,
  reviews = [],
}: {
  product: Product
  related: ProductCardData[]
  settings: StoreSettings
  reviews?: ProductReview[]
}) {
  const taxNote = priceNote(settings)
  const surcharges = describeProductSurcharges(product, settings)
  const returnDays = product.returnWindowDays ?? settings.returnWindowDays
  const perks = [
    { icon: HandHeartIcon, text: settings.highlightLine },
    {
      icon: TruckIcon,
      text:
        settings.freeDeliveryAbove > 0
          ? `Free delivery above ${formatPrice(settings.freeDeliveryAbove)}`
          : `Delivery ${formatPrice(settings.deliveryFee)} per order`,
    },
    {
      icon: RotateCcwIcon,
      text:
        returnDays > 0
          ? `${returnDays}-day return & exchange window after delivery`
          : "Non-returnable item (damaged-in-transit help on WhatsApp)",
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
      <div className={styles.crumbsBar}>
        <Breadcrumbs items={crumbs} />
      </div>

      <div className={styles.detailGrid}>
        <FadeIn y={16} className={styles.galleryColumn}>
          <ProductGallery images={product.images} name={product.name} />
        </FadeIn>

        <FadeIn y={16} delay={0.1} className={styles.infoColumn}>
          <ProductVariantProvider product={product}>
          {product.category && (
            <p className={styles.categoryEyebrow}>{product.category.name}</p>
          )}
          <h1 className={styles.productHeading}>{product.name}</h1>

          <ProductLivePriceHeader product={product} styles={styles} />
          {taxNote && <p className={styles.taxNoteText}>{taxNote}</p>}

          {summary && <p className={styles.summaryText}>{summary}</p>}

          {product.highlights.length > 0 && (
            <ul className={styles.highlightsList} aria-label="Highlights">
              {product.highlights.map((h, idx) => (
                <li key={`${idx}-${h}`} className={styles.highlightItem}>
                  <CheckCircle2Icon className={styles.checkIcon} aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {surcharges.length > 0 && (
            <div className={styles.surchargesBox}>
              <p className={styles.surchargeHeading}>
                <InfoIcon className={styles.infoIcon} aria-hidden /> Special shipping &amp; handling
              </p>
              <ul className={styles.surchargeList}>
                {surcharges.map((f, idx) => (
                  <li key={`${idx}-${f.label}`}>
                    <span className={styles.surchargeLabel}>
                      {f.label}: {formatPrice(f.amount)}
                    </span>
                    <span className={styles.surchargeReason}>{f.reason}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.surchargeFooterNote}>Calculated across your whole order at checkout, never compounded per item.</p>
            </div>
          )}

          <div className={styles.actionsMount}>
            <ProductActions product={product} />
          </div>
          </ProductVariantProvider>

          {/* Trust row: compact, directly under the buttons (where the doubt is). */}
          <ul className={styles.perksCard}>
            {perks.map((p) => (
              <li key={p.text} className={styles.perkRow}>
                <span className={styles.perkIconCircle}>
                  <p.icon className={styles.perkIcon} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <section className={styles.aboutSection} aria-labelledby="details-title">
            <h2 id="details-title" className={styles.subHeading}>
              About this product
            </h2>
            <ReadMore length={product.description.length} className={styles.readMoreWrap}>
              <div className={styles.descriptionProse}>{product.description}</div>
            </ReadMore>
          </section>

          {product.specs.length > 0 && (
            <section className={styles.specsSection} aria-labelledby="specs-title">
              <h2 id="specs-title" className={styles.subHeading}>Details</h2>
              <dl className={styles.specsCard}>
                {product.specs.map((s, idx) => (
                  <div key={`${idx}-${s.label}`} className={styles.specRow}>
                    <dt className={styles.specTerm}>{s.label}</dt>
                    <dd className={styles.specValue}>{s.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className={styles.accordionMount}>
            <Accordion>
              {product.careInstructions && <AccordionItem title="Care instructions">{product.careInstructions}</AccordionItem>}
              <AccordionItem title="Delivery & returns">
                {freeDelivery} We pack every order carefully and share live courier tracking details once dispatched.{" "}
                {returnDays > 0
                  ? `You can request a return or exchange within ${returnDays} ${returnDays === 1 ? "day" : "days"} of delivery from your Order page.`
                  : "This piece is non-returnable once delivered; if it arrives damaged in transit, message us on WhatsApp right away."}
              </AccordionItem>
            </Accordion>
          </div>
        </FadeIn>
      </div>

      <ProductReviewsSection product={product} initialReviews={reviews} />

      {related.length > 0 && (
        <section className={styles.relatedSection} aria-labelledby="related-title">
          <SectionHeading id="related-title" eyebrow="You may also like" title="More you may like" href="/products" />
          <ProductCarousel products={related} label="More you may like" priorityCount={0} />
        </section>
      )}

    </>
  )
}

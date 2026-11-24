import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { FadeIn } from "@/components/shared/motion"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { CategoryGrid } from "@/components/store/category-grid"
import { Hero } from "@/components/store/hero"
import { HowItWorks } from "@/components/store/how-it-works"
import { ProductGrid } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import type { Category, ProductCardData } from "@/features/products/types"
import type { StoreSettings } from "@/features/settings/types"
import styles from "./home-view.module.css"

/** The home page. The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function HomeView({
  featured,
  all,
  categories,
  shop,
}: {
  featured: ProductCardData[]
  all: ProductCardData[]
  categories: (Category & { count: number })[]
  shop: StoreSettings
}) {
  const inStockAll = all.filter((p) => p.stock > 0)
  const inStockFeatured = featured.filter((p) => p.stock > 0)
  const newArrivals = inStockAll.slice(0, 4)
  // Keep the grid's last row full on 4-column desktops (4 or 8 cards).
  const bestsellers = inStockFeatured.length >= 8 ? inStockFeatured.slice(0, 8) : inStockFeatured.slice(0, 4)

  return (
    <>
      <Hero showcase={inStockFeatured.slice(0, 3)} />

      <div className={styles.homeContentStack}>
        {categories.length > 0 && (
          <section className={styles.pageSection} aria-labelledby="cat-title">
            <SectionHeading id="cat-title" eyebrow="Browse" title="Shop by category" href="/products" />
            <CategoryGrid categories={categories} />
          </section>
        )}

        {bestsellers.length > 0 && (
          <section className={styles.pageSection} aria-labelledby="featured-title">
            <SectionHeading id="featured-title" eyebrow="Loved by customers" title="Bestsellers" href="/products" />
            <ProductGrid products={bestsellers} priorityCount={0} />
          </section>
        )}

        <HowItWorks />

        {newArrivals.length > 0 && (
          <section className={styles.pageSection} aria-labelledby="new-title">
            <SectionHeading id="new-title" eyebrow="Fresh from the studio" title="New arrivals" href="/products?sort=new" />
            <ProductGrid products={newArrivals} priorityCount={0} />
          </section>
        )}

        {/* CTA band */}
        <section className={styles.pageSection}>
          <FadeIn className={styles.bespokeBanner}>
            <p className={styles.bannerEyebrow}>Bespoke studio</p>
            <h2 className={styles.bannerTitle}>
              Looking for something custom?
            </h2>
            <p className={styles.bannerSubtitle}>
              Personalised names, colours or bulk gifting — tell us what you have in mind and we&apos;ll make it by hand.
            </p>
            <div className={styles.bannerActions}>
              <a
                href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I'd like a custom order.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.chatAccentBtn}
              >
                <WhatsAppIcon className={styles.chatBtnIcon} /> Chat with us
              </a>
              <Link
                href="/products"
                className={styles.browseOutlineBtn}
              >
                Browse all <ArrowRightIcon className={styles.browseArrow} aria-hidden />
              </Link>
            </div>
          </FadeIn>
        </section>
      </div>
    </>
  )
}

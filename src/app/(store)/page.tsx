import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { JsonLd } from "@/components/shared/json-ld"
import { FadeIn } from "@/components/shared/motion"
import { CategoryGrid } from "@/components/store/category-grid"
import { Hero } from "@/components/store/hero"
import { HowItWorks } from "@/components/store/how-it-works"
import { ProductGrid } from "@/components/store/product-grid"
import { SectionHeading } from "@/components/store/section-heading"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import {
  getActiveProducts,
  getCategoriesWithCounts,
  getFeaturedProducts,
} from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { websiteJsonLd } from "@/lib/seo"

export default async function HomePage() {
  const [featured, all, categories, shop] = await Promise.all([
    getFeaturedProducts(8),
    getActiveProducts(),
    getCategoriesWithCounts(),
    getStoreSettings(),
  ])
  const newArrivals = all.slice(0, 4)
  // Keep the grid's last row full on 4-column desktops (4 or 8 cards).
  const bestsellers = featured.length >= 8 ? featured.slice(0, 8) : featured.slice(0, 4)

  return (
    <>
      <Hero showcase={featured.slice(0, 3)} />

      <div className="space-y-24 pt-16 sm:space-y-28">
        {categories.length > 0 && (
          <section className="container-page" aria-labelledby="cat-title">
            <SectionHeading id="cat-title" eyebrow="Browse" title="Shop by category" href="/products" />
            <CategoryGrid categories={categories} />
          </section>
        )}

        <section className="container-page" aria-labelledby="featured-title">
          <SectionHeading id="featured-title" eyebrow="Loved by customers" title="Bestsellers" href="/products" />
          <ProductGrid products={bestsellers} />
        </section>

        <HowItWorks />

        {newArrivals.length > 0 && (
          <section className="container-page" aria-labelledby="new-title">
            <SectionHeading id="new-title" eyebrow="Fresh from the studio" title="New arrivals" href="/products?sort=new" />
            <ProductGrid products={newArrivals} priorityCount={0} />
          </section>
        )}

        {/* CTA band */}
        <section className="container-page">
          <FadeIn className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-primary via-[oklch(0.56_0.15_25)] to-[oklch(0.5_0.13_10)] px-6 py-14 text-center text-primary-foreground shadow-2xl shadow-primary/20 sm:px-12 sm:py-20">
            <div aria-hidden className="absolute -top-20 -left-20 size-72 rounded-full bg-white/10 blur-2xl animate-blob" />
            <div aria-hidden className="absolute -right-16 -bottom-24 size-80 rounded-full bg-white/10 blur-2xl animate-blob [animation-delay:-8s]" />
            <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold sm:text-5xl">
              Looking for something custom?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/85 sm:text-lg">
              Personalised names, colours or bulk gifting — tell us what you have in mind and we&apos;ll make it by hand.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I'd like a custom order.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-neutral-900 shadow-lg transition-transform hover:-translate-y-0.5"
              >
                <WhatsAppIcon className="size-5 text-whatsapp" /> Chat with us
              </a>
              <Link
                href="/products"
                className="group inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-6 font-semibold transition-colors hover:bg-white/10"
              >
                Browse all <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </FadeIn>
        </section>
      </div>

      <JsonLd data={websiteJsonLd(shop)} />
    </>
  )
}

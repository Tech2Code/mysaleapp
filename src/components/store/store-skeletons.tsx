import { Skeleton } from "@/components/ui/skeleton"
import { SkeletonField, SkeletonLine, SkeletonText, bonewidth } from "@/components/shared/skeleton-kit"
import { PageHeader } from "./page-header"
import { SectionHeading } from "./section-heading"
import { cn } from "@/lib/utils"

/**
 * Storefront loading skeletons. Static text (page titles, breadcrumbs, section headings) is
 * rendered by the REAL `PageHeader` / `SectionHeading`, so only data-driven parts shimmer and
 * nothing jumps when the content arrives. Grids use the same classes as `ProductGrid` etc.
 */

/** Mirrors `ProductCard`: 4:5 image, category line, two-line name, price. */
function ProductCardSkeleton() {
  return (
    <div data-ui="store/ProductCardSkeleton" className="flex h-full flex-col" aria-hidden>
      <Skeleton data-ui="store/ProductCardSkeleton/Skeleton" className="aspect-4/5 rounded-2xl" />
      <div data-ui="store/ProductCardSkeleton/div" className="mt-3 space-y-2 px-0.5">
        <Skeleton data-ui="store/ProductCardSkeleton/Skeleton-2" className="h-3 w-1/3 rounded" />
        <Skeleton data-ui="store/ProductCardSkeleton/Skeleton-3" className="h-4 w-5/6 rounded" />
        <Skeleton data-ui="store/ProductCardSkeleton/Skeleton-4" className="mt-1 h-5 w-16 rounded" />
      </div>
    </div>
  )
}

/** Same grid classes as `ProductGrid`. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div data-ui="store/ProductGridSkeleton" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Same grid + tile height as `CategoryGrid`. */
function CategoryGridSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div data-ui="store/CategoryGridSkeleton" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton data-ui="store/CategoryGridSkeleton/Skeleton" key={i} className="h-36 rounded-3xl sm:h-44" />
      ))}
    </div>
  )
}

type Crumbs = { name: string; href?: string }[]

/** Title/description/breadcrumbs for real, then the dynamic body. */
function HeaderThen({ title, description, breadcrumbs, children }: { title: string; description?: string; breadcrumbs: Crumbs; children: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />
      <div data-ui="store/HeaderThen/div" className="container-page pt-4 sm:pt-6" aria-hidden>
        {children}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- pages

export function HomeSkeleton() {
  return (
    <>
      <section data-ui="store/HomeSkeleton/section-relative" className="relative isolate overflow-hidden bg-hero" aria-hidden>
        <div data-ui="store/HomeSkeleton/div-grid" className="container-page grid items-center gap-8 pt-10 pb-20 sm:gap-12 md:pt-16 lg:grid-cols-2 lg:pb-28">
          <div data-ui="store/HomeSkeleton/div" className="max-w-xl space-y-5">
            <Skeleton data-ui="store/HomeSkeleton/Skeleton" className="h-8 w-64 rounded-full" />
            <Skeleton data-ui="store/HomeSkeleton/Skeleton-2" className="h-14 w-full rounded-xl sm:h-16" />
            <Skeleton data-ui="store/HomeSkeleton/Skeleton-3" className="h-14 w-4/5 rounded-xl sm:h-16" />
            <SkeletonText lines={3} className="max-w-lg" />
            <div data-ui="store/HomeSkeleton/div-flex" className="flex gap-3 pt-2">
              <Skeleton data-ui="store/HomeSkeleton/Skeleton-4" className="h-12 w-40 rounded-full" />
              <Skeleton data-ui="store/HomeSkeleton/Skeleton-5" className="h-12 w-36 rounded-full" />
            </div>
          </div>
          <Skeleton data-ui="store/HomeSkeleton/Skeleton-6" className="aspect-4/5 max-h-136 w-full rounded-4xl lg:justify-self-end" />
        </div>
      </section>

      <div data-ui="store/HomeSkeleton/div-2" className="space-y-24 pt-16 sm:space-y-28">
        <section data-ui="store/HomeSkeleton/section" className="container-page">
          <SectionHeading eyebrow="Browse" title="Shop by category" href="/products" />
          <CategoryGridSkeleton />
        </section>
        <section data-ui="store/HomeSkeleton/section-2" className="container-page">
          <SectionHeading eyebrow="Loved by customers" title="Bestsellers" href="/products" />
          <ProductGridSkeleton count={8} />
        </section>
      </div>
    </>
  )
}

export function ProductsListSkeleton() {
  return (
    <HeaderThen
      title="Shop all"
      description="Every piece is made by hand in small batches — no two are exactly alike."
      breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop all" }]}
    >
      <Skeleton data-ui="store/ProductsListSkeleton/Skeleton" className="mb-6 h-11 w-full max-w-md rounded-full" />
      <ProductGridSkeleton count={8} />
    </HeaderThen>
  )
}

export function CategorySkeleton() {
  return (
    <div data-ui="store/CategorySkeleton" aria-hidden>
      <section data-ui="store/CategorySkeleton/section-relative" className="relative overflow-hidden bg-hero">
        <div data-ui="store/CategorySkeleton/div" className="container-page pt-8 pb-6 sm:pt-12 sm:pb-8">
          <Skeleton data-ui="store/CategorySkeleton/Skeleton" className="h-5 w-56 rounded" />
          <Skeleton data-ui="store/CategorySkeleton/Skeleton-2" className="mt-4 h-10 w-72 rounded-xl sm:h-12" />
          <Skeleton data-ui="store/CategorySkeleton/Skeleton-3" className="mt-3 h-5 w-full max-w-2xl rounded" />
        </div>
      </section>
      <div data-ui="store/CategorySkeleton/div-2" className="container-page pt-4 sm:pt-6">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div data-ui="store/ProductDetailSkeleton" aria-hidden>
      <div data-ui="store/ProductDetailSkeleton/div" className="container-page pt-6 pb-4">
        <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton" className="h-5 w-64 rounded" />
      </div>
      <div data-ui="store/ProductDetailSkeleton/div-grid" className="container-page grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div data-ui="store/ProductDetailSkeleton/div-2">
          <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-2" className="aspect-4/5 rounded-3xl" />
          <div data-ui="store/ProductDetailSkeleton/div-grid-2" className="mt-6 grid grid-cols-3 gap-2 rounded-3xl border bg-card p-3 sm:gap-3 sm:p-5">
            {[0, 1, 2].map((i) => (
              <div data-ui="store/ProductDetailSkeleton/div-flex" key={i} className="flex flex-col items-center gap-2">
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-3" className="size-9 rounded-full" />
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-4" className="h-3 w-4/5 rounded" />
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-5" className="h-3 w-3/5 rounded" />
              </div>
            ))}
          </div>
        </div>
        <div data-ui="store/ProductDetailSkeleton/div-3" className="min-w-0 space-y-4">
          <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-6" className="h-4 w-28 rounded" />
          <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-7" className="h-10 w-4/5 rounded-xl sm:h-12" />
          <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-8" className="h-9 w-44 rounded" />
          <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-9" className="h-3 w-32 rounded" />
          <SkeletonText lines={3} />
          <div data-ui="store/ProductDetailSkeleton/div-4" className="space-y-2.5 pt-1">
            {[0, 1, 2].map((i) => (
              <div data-ui="store/ProductDetailSkeleton/div-flex-2" key={i} className="flex items-center gap-2.5">
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-10" className="size-4 shrink-0 rounded-full" />
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-11" className={cn("h-4 rounded", bonewidth(i))} />
              </div>
            ))}
          </div>
          <div data-ui="store/ProductDetailSkeleton/div-flex-3" className="flex gap-3 pt-6">
            <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-12" className="h-12 w-32 rounded-full" />
            <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-13" className="h-12 flex-1 rounded-full" />
          </div>
        </div>
      </div>
      <section data-ui="store/ProductDetailSkeleton/section-grid" className="container-page mt-10 grid gap-10 sm:mt-16 lg:grid-cols-2 lg:gap-16">
        <div data-ui="store/ProductDetailSkeleton/div-5">
          <h2 data-ui="store/ProductDetailSkeleton/h2-about-this-piece" className="text-2xl font-semibold">About this piece</h2>
          <SkeletonText lines={5} className="mt-4" />
        </div>
        <div data-ui="store/ProductDetailSkeleton/div-6">
          <h2 data-ui="store/ProductDetailSkeleton/h2-details" className="text-2xl font-semibold">Details</h2>
          <div data-ui="store/ProductDetailSkeleton/div-7" className="mt-4 divide-y rounded-3xl border bg-card px-5 sm:px-6">
            {[0, 1, 2, 3].map((i) => (
              <div data-ui="store/ProductDetailSkeleton/div-grid-3" key={i} className="grid grid-cols-[8rem_1fr] gap-4 py-3 sm:grid-cols-[10rem_1fr]">
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-14" className="h-4 w-20 rounded" />
                <Skeleton data-ui="store/ProductDetailSkeleton/Skeleton-15" className={cn("h-4 rounded", bonewidth(i))} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Cart/checkout share a "list + summary" shape. */
function ListAndSummary({ side, rows, rowClass }: { side: string; rows: number; rowClass: string }) {
  return (
    <div data-ui="store/ListAndSummary" className={cn("grid gap-8", side)}>
      <div data-ui="store/ListAndSummary/div" className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton data-ui="store/ListAndSummary/Skeleton" key={i} className={rowClass} />
        ))}
      </div>
      <Skeleton data-ui="store/ListAndSummary/Skeleton-2" className="h-64 rounded-3xl" />
    </div>
  )
}

export function CartSkeleton() {
  return (
    <HeaderThen title="Your cart" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart" }]}>
      <ListAndSummary side="lg:grid-cols-[1fr_380px]" rows={3} rowClass="h-32 rounded-3xl" />
    </HeaderThen>
  )
}

export function CheckoutSkeleton() {
  return (
    <HeaderThen
      title="Checkout"
      description="Enter your delivery details, then pay by UPI to confirm your order."
      breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]}
    >
      <div data-ui="store/CheckoutSkeleton/div-grid" className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div data-ui="store/CheckoutSkeleton/div" className="rounded-3xl border bg-card p-5 sm:p-6">
          <div data-ui="store/CheckoutSkeleton/div-grid-2" className="grid gap-x-5 sm:grid-cols-2">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonField key={i} />
            ))}
          </div>
        </div>
        <Skeleton data-ui="store/CheckoutSkeleton/Skeleton" className="h-72 rounded-3xl" />
      </div>
    </HeaderThen>
  )
}

export function WishlistSkeleton() {
  return (
    <HeaderThen title="Your wishlist" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Wishlist" }]}>
      <ProductGridSkeleton count={4} />
    </HeaderThen>
  )
}

export function TrackSkeleton() {
  return (
    <HeaderThen
      title="Track your order"
      description="Enter the order code from your WhatsApp message and the last 4 digits of your phone number."
      breadcrumbs={[{ name: "Home", href: "/" }, { name: "Track order" }]}
    >
      <div data-ui="store/TrackSkeleton/div" className="max-w-xl rounded-3xl border bg-card p-5 sm:p-6">
        <SkeletonField />
        <SkeletonField />
        <Skeleton data-ui="store/TrackSkeleton/Skeleton" className="h-11 w-36 rounded-full" />
      </div>
    </HeaderThen>
  )
}

export function ContactSkeleton() {
  return (
    <HeaderThen
      title="Contact us"
      description="Questions, custom orders or just saying hello — we'd love to hear from you."
      breadcrumbs={[{ name: "Home", href: "/" }, { name: "Contact" }]}
    >
      <div data-ui="store/ContactSkeleton/div-grid" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div data-ui="store/ContactSkeleton/div" key={i} className="space-y-3 rounded-3xl border bg-card p-6">
            <Skeleton data-ui="store/ContactSkeleton/Skeleton" className="size-10 rounded-full" />
            <SkeletonLine className="w-1/3" />
            <SkeletonLine className={bonewidth(i)} />
          </div>
        ))}
      </div>
    </HeaderThen>
  )
}

/** Fallback for small pages (about, login, account…): heading block + one card. */
export function PlainPageSkeleton() {
  return (
    <div data-ui="store/PlainPageSkeleton" className="container-page space-y-6 py-10 sm:py-14" aria-hidden>
      <Skeleton data-ui="store/PlainPageSkeleton/Skeleton" className="h-5 w-48 rounded" />
      <Skeleton data-ui="store/PlainPageSkeleton/Skeleton-2" className="h-10 w-64 rounded-xl sm:h-12" />
      <div data-ui="store/PlainPageSkeleton/div" className="rounded-3xl border bg-card p-5 sm:p-6">
        <SkeletonText lines={4} />
      </div>
    </div>
  )
}

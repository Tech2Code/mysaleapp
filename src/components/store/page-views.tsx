import { ArrowRightIcon, HandHeartIcon, LeafIcon, MailIcon, MapPinIcon, PhoneIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import { Suspense, type ComponentType, type ReactNode, type SVGProps } from "react"
import { FadeIn } from "@/components/shared/motion"
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/store/brand-icons"
import { CartView } from "@/components/store/cart-view"
import { CheckoutForm } from "@/components/store/checkout-form"
import { GoogleSignIn } from "@/components/store/google-sign-in"
import { OrderPlaced } from "@/components/store/order-placed"
import { PageHeader } from "@/components/store/page-header"
import { PRODUCTS_PER_PAGE, ProductBrowser } from "@/components/store/product-browser"
import { ProductGrid } from "@/components/store/product-grid"
import { TrackOrder } from "@/components/store/track-order"
import { WishlistView } from "@/components/store/wishlist-view"
import type { LiveProduct } from "@/components/store/live-cart"
import { buttonVariants } from "@/components/ui/button"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import type { Profile } from "@/features/account/schema"
import type { Address } from "@/features/addresses/types"
import type { Category, ProductCardData, ProductListItem } from "@/features/products/types"
import { gstActive } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { safeExternalUrl } from "@/lib/safe-redirect"
import { cn } from "@/lib/utils"
import styles from "./page-views.module.css"

/**
 * The small storefront pages. Each is rendered by its page with real data and by its loading.tsx
 * (inside <Skeletonize>) with placeholder data, so the two always have the same layout.
 * `preview` makes a component whose content lives in the browser (cart, wishlist…) show a placeholder.
 */

/** Wrapper used by pages that sit under a PageHeader. */
function Body({ children }: { children: ReactNode }) {
  return <div className={styles.pageBodyContainer}>{children}</div>
}

export function CartPageView({ products, preview }: { products: LiveProduct[]; preview?: boolean }) {
  return (
    <>
      <PageHeader title="Your cart" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart" }]} />
      <Body>
        <CartView products={products} preview={preview} />
      </Body>
    </>
  )
}

export function CheckoutPageView({
  products,
  initialAddresses,
  initialProfile,
  initialUserId = null,
  preview,
}: {
  products: LiveProduct[]
  initialAddresses?: Address[]
  initialProfile?: Profile | null
  initialUserId?: string | null
  preview?: boolean
}) {
  return (
    <>
      <PageHeader
        title="Checkout"
        description="Confirm your delivery details and pay by UPI to place your order."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]}
      />
      <Body>
        <CheckoutForm
          products={products}
          initialAddresses={initialAddresses}
          initialProfile={initialProfile}
          initialUserId={initialUserId}
          preview={preview}
        />
      </Body>
    </>
  )
}

export function WishlistPageView({ products, preview }: { products: ProductCardData[]; preview?: boolean }) {
  return (
    <>
      <PageHeader title="Your wishlist" breadcrumbs={[{ name: "Home", href: "/" }, { name: "Wishlist" }]} />
      <Body>
        <WishlistView products={products} preview={preview} />
      </Body>
    </>
  )
}

export function ProductsPageView({ items, categories }: { items: ProductListItem[]; categories: Pick<Category, "id" | "name" | "slug">[] }) {
  return (
    <>
      <PageHeader
        title="Shop all"
        description="Every piece is made by hand in small batches — no two are exactly alike."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop all" }]}
      />
      <Body>
        {/* Fallback is the first page of the crawlable grid; filters and pagination hydrate on top of it. */}
        <Suspense fallback={<ProductGrid products={items.slice(0, PRODUCTS_PER_PAGE)} />}>
          <ProductBrowser products={items} categories={categories} />
        </Suspense>
      </Body>
    </>
  )
}

export function TrackPageView() {
  return (
    <>
      <PageHeader
        title="Track your order"
        description="Enter the order code from your WhatsApp message and the last 4 digits of your phone number."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Track order" }]}
      />
      <Body>
        <Suspense>
          <TrackOrder />
        </Suspense>
      </Body>
    </>
  )
}

export function OrderPlacedPageView({ preview }: { preview?: boolean }) {
  return (
    <section className={styles.heroBackdropSection}>
      <div className={styles.orderPlacedContainer}>
        <Suspense>
          <OrderPlaced preview={preview} />
        </Suspense>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- about

const values = [
  { icon: HandHeartIcon, title: "Made by hand", text: "Every piece is shaped, painted or woven by a real person — never mass-produced." },
  { icon: LeafIcon, title: "Mindful materials", text: "Natural clay, cotton, jute, soy wax and wood, sourced responsibly wherever we can." },
  { icon: SparklesIcon, title: "Personal service", text: "Chat with us on WhatsApp for questions, custom orders and delivery updates." },
]

export function AboutView({ shop }: { shop: StoreSettings }) {
  return (
    <>
      <PageHeader
        title="Our story"
        description={`${shop.shopName} began with a simple idea: the things we live with should carry a little bit of someone's heart.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "About" }]}
      />
      <div className={styles.aboutContainer}>
        <FadeIn className={styles.storyIntro}>
          <p className={styles.storyParagraph}>
            We work with small studios and independent artisans{shop.city ? ` around ${shop.city}` : ""} to bring you decor and
            gifts that feel personal. Each piece is made in small batches, which means tiny variations in colour and texture —
            that&apos;s the beauty of handmade.
          </p>
          <p className={styles.storyParagraph}>
            Have something specific in mind? We love custom orders — personalised names, colours and bulk gifting for
            weddings and festivals.
          </p>
        </FadeIn>
        <div className={styles.valuesGrid}>
          {values.map((v, i) => (
            <FadeIn key={v.title} delay={i * 0.08} className={styles.valueCard}>
              <v.icon className={styles.valueIcon} />
              <h2 className={styles.valueTitle}>{v.title}</h2>
              <p className={styles.valueText}>{v.text}</p>
            </FadeIn>
          ))}
        </div>
        <div className={styles.exploreActionWrap}>
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }), styles.exploreBtn)}>
            Explore the collection
          </Link>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- contact

type ContactCard = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  text: string
  href: string
  cta: string
}

export function ContactView({ shop }: { shop: StoreSettings }) {
  // Only the details the owner has filled in under Admin → Settings are shown.
  const cards: ContactCard[] = [
    {
      icon: WhatsAppIcon,
      title: "WhatsApp",
      text: "The fastest way to reach us",
      href: shopWhatsappLink(shop, `Hi ${shop.shopName}!`),
      cta: "Start chat",
    },
    ...(shop.email
      ? [{ icon: MailIcon, title: "Email", text: shop.email, href: `mailto:${shop.email}`, cta: "Send email" }]
      : []),
    ...(shop.phone
      ? [{ icon: PhoneIcon, title: "Call us", text: shop.phone, href: `tel:${shop.phone.replace(/[^\d+]/g, "")}`, cta: "Call now" }]
      : []),
    ...(safeExternalUrl(shop.instagramUrl)
      ? [{ icon: InstagramIcon, title: "Instagram", text: "See new pieces first", href: safeExternalUrl(shop.instagramUrl)!, cta: "Follow us" }]
      : []),
    ...(safeExternalUrl(shop.facebookUrl)
      ? [{ icon: FacebookIcon, title: "Facebook", text: "Updates and offers", href: safeExternalUrl(shop.facebookUrl)!, cta: "Visit page" }]
      : []),
  ]
  const place = [shop.city, shop.region].filter(Boolean).join(", ")

  return (
    <>
      <PageHeader
        title="Contact us"
        description="Questions, custom orders or just saying hello — we'd love to hear from you."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Contact" }]}
      />
      <div className={styles.contactContainer}>
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className={styles.contactCard}
          >
            <span className={styles.contactIconBox}>
              <c.icon className={styles.contactIcon} />
            </span>
            <h2 className={styles.contactTitle}>{c.title}</h2>
            <p className={styles.contactText}>{c.text}</p>
            <span className={styles.contactCtaRow}>
              {c.cta} <ArrowRightIcon className={styles.ctaArrow} />
            </span>
          </a>
        ))}
        {place && (
          <p className={styles.studioLocationNote}>
            <MapPinIcon className={styles.pinIcon} /> Studio in {place}. Shipping across India.
          </p>
        )}
        <div className={styles.businessLegalCard}>
          <h2 className={styles.legalCardTitle}>
            Business &amp; Grievance Redressal Details
          </h2>
          <p className={styles.legalCardSub}>
            Operated by <span className={styles.legalStrong}>{shop.legalName?.trim() || shop.shopName}</span>
            {shop.businessAddress?.trim() ? ` · ${shop.businessAddress.trim()}` : place ? ` · ${place}, India` : " · India"}.
          </p>
          <div className={styles.legalMetaRow}>
            {shop.email && (
              <span>
                Grievance / Support Email: <strong className={styles.legalStrong}>{shop.email}</strong>
              </span>
            )}
            {gstActive(shop) && shop.gstin && (
              <span>
                GSTIN: <strong className={styles.legalStrong}>{shop.gstin}</strong>
              </span>
            )}
          </div>
          <div className={styles.legalLinksBar}>
            <Link href="/privacy" className={styles.legalPolicyLink}>
              Privacy Policy
            </Link>
            <Link href="/terms" className={styles.legalPolicyLink}>
              Terms of Service
            </Link>
            <Link href="/refund-policy" className={styles.legalPolicyLink}>
              Refund &amp; Return Policy
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- login

export function LoginView({ shop }: { shop: StoreSettings }) {
  return (
    <section className={styles.heroBackdropSection}>
      <div className={styles.loginContainer}>
        <GoogleSignIn shopName={shop.shopName} />
      </div>
    </section>
  )
}

import { HandHeartIcon, HeartIcon, LeafIcon, MailIcon, MapPinIcon, PackageIcon, PhoneIcon, SparklesIcon } from "lucide-react"
import Link from "next/link"
import { Suspense, type ComponentType, type ReactNode, type SVGProps } from "react"
import { LogoMark } from "@/components/shared/logo"
import { FadeIn } from "@/components/shared/motion"
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/store/brand-icons"
import { CartView } from "@/components/store/cart-view"
import { CheckoutForm } from "@/components/store/checkout-form"
import { GoogleSignIn } from "@/components/store/google-sign-in"
import { OrderPlaced } from "@/components/store/order-placed"
import { PageHeader } from "@/components/store/page-header"
import { ProductBrowser } from "@/components/store/product-browser"
import { ProductGrid } from "@/components/store/product-grid"
import { TrackOrder } from "@/components/store/track-order"
import { WishlistView } from "@/components/store/wishlist-view"
import type { LiveProduct } from "@/components/store/live-cart"
import { buttonVariants } from "@/components/ui/button"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import type { Category, ProductCardData, ProductListItem } from "@/features/products/types"
import type { StoreSettings } from "@/features/settings/types"
import { cn } from "@/lib/utils"

/**
 * The small storefront pages. Each is rendered by its page with real data and by its loading.tsx
 * (inside <Skeletonize>) with placeholder data, so the two always have the same layout.
 * `preview` makes a component whose content lives in the browser (cart, wishlist…) show a placeholder.
 */

/** Wrapper used by pages that sit under a PageHeader. */
function Body({ children }: { children: ReactNode }) {
  return <div data-ui="store/Body" className="container-page pt-4 sm:pt-6">{children}</div>
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

export function CheckoutPageView({ products, preview }: { products: LiveProduct[]; preview?: boolean }) {
  return (
    <>
      <PageHeader
        title="Checkout"
        description="Enter your delivery details, then pay by UPI to confirm your order."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Cart", href: "/cart" }, { name: "Checkout" }]}
      />
      <Body>
        <CheckoutForm products={products} preview={preview} />
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
        {/* Fallback is the full, crawlable grid; filters hydrate on top of it. */}
        <Suspense fallback={<ProductGrid products={items} />}>
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
    <section data-ui="store/OrderPlacedPageView" className="bg-hero">
      <div data-ui="store/OrderPlacedPageView/div" className="container-page py-16 sm:py-24">
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
      <div data-ui="store/AboutView/div" className="container-page space-y-10 sm:space-y-16 pt-8 sm:pt-12">
        <FadeIn className="mx-auto max-w-3xl space-y-5 text-lg/relaxed  text-muted-foreground">
          <p data-ui="store/AboutView/p">
            We work with small studios and independent artisans{shop.city ? ` around ${shop.city}` : ""} to bring you decor and
            gifts that feel personal. Each piece is made in small batches, which means tiny variations in colour and texture —
            that&apos;s the beauty of handmade.
          </p>
          <p data-ui="store/AboutView/p-2">
            Have something specific in mind? We love custom orders — personalised names, colours and bulk gifting for
            weddings and festivals.
          </p>
        </FadeIn>
        <div data-ui="store/AboutView/div-grid" className="grid gap-5 md:grid-cols-3">
          {values.map((v, i) => (
            <FadeIn key={v.title} delay={i * 0.08} className="rounded-3xl border bg-card p-7">
              <v.icon data-ui="store/AboutView/v.icon" className="size-8 text-primary" />
              <h2 data-ui="store/AboutView/h2" className="mt-4 font-sans text-xl font-semibold">{v.title}</h2>
              <p data-ui="store/AboutView/p-3" className="mt-2 text-muted-foreground">{v.text}</p>
            </FadeIn>
          ))}
        </div>
        <div data-ui="store/AboutView/div-2" className="text-center">
          <Link data-ui="store/AboutView/Link-explore-the-collection" href="/products" className={cn(buttonVariants({ size: "lg" }), "h-12 rounded-full px-5 sm:px-8 text-base")}>
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
    ...(shop.instagramUrl
      ? [{ icon: InstagramIcon, title: "Instagram", text: "See new pieces first", href: shop.instagramUrl, cta: "Follow us" }]
      : []),
    ...(shop.facebookUrl
      ? [{ icon: FacebookIcon, title: "Facebook", text: "Updates and offers", href: shop.facebookUrl, cta: "Visit page" }]
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
      <div data-ui="store/ContactView/div-grid" className="container-page grid gap-5 pt-8 sm:pt-12 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <a data-ui="store/ContactView/a"
            key={c.title}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group rounded-3xl border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <span data-ui="store/ContactView/span-grid" className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <c.icon data-ui="store/ContactView/c.icon" className="size-6" />
            </span>
            <h2 data-ui="store/ContactView/h2" className="mt-5 font-sans text-xl font-semibold">{c.title}</h2>
            <p data-ui="store/ContactView/p" className="mt-1 text-muted-foreground">{c.text}</p>
            <span data-ui="store/ContactView/span" className="mt-4 inline-block font-semibold text-primary group-hover:underline">{c.cta} →</span>
          </a>
        ))}
        {place && (
          <p data-ui="store/ContactView/p-flex" className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            <MapPinIcon className="size-4" /> Studio in {place}. Shipping across India.
          </p>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- login

const perks = [
  { icon: PackageIcon, text: "Track all your orders in one place" },
  { icon: HeartIcon, text: "Keep your wishlist on every device" },
  { icon: MapPinIcon, text: "Save your address for faster checkout" },
]

export function LoginView({ shop }: { shop: StoreSettings }) {
  return (
    <section data-ui="store/LoginView" className="bg-hero">
      <div data-ui="store/LoginView/div-flex" className="container-page flex min-h-[70vh] items-center justify-center py-12 sm:py-16">
        <div data-ui="store/LoginView/div" className="w-full max-w-md rounded-4xl border bg-card/80 p-8 shadow-2xl shadow-black/5 backdrop-blur sm:p-10">
          <LogoMark className="size-12 text-2xl" />
          <h1 data-ui="store/LoginView/h1-welcome-to" className="mt-6 text-3xl font-semibold">Welcome to {shop.shopName}</h1>
          <p data-ui="store/LoginView/p" className="mt-2 text-muted-foreground">Sign in with one tap — no password to remember.</p>

          <ul data-ui="store/LoginView/ul" className="my-8 space-y-3">
            {perks.map((p) => (
              <li data-ui="store/LoginView/li-flex" key={p.text} className="flex items-center gap-3 text-sm">
                <span data-ui="store/LoginView/span-grid" className="grid size-8 place-items-center rounded-full bg-secondary text-primary">
                  <p.icon data-ui="store/LoginView/p.icon" className="size-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>

          <Suspense>
            <GoogleSignIn />
          </Suspense>

          <p data-ui="store/LoginView/p-2" className="mt-6 text-center text-xs text-muted-foreground">
            Signing in is optional — you can also{" "}
            <Link data-ui="store/LoginView/Link-order-as-a-guest" href="/products" className="font-medium text-primary underline-offset-4 hover:underline">
              order as a guest
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  )
}

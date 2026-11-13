import { BackToTop } from "@/components/shared/back-to-top"
import { ScrollLink } from "@/components/shared/scroll-link"
import { Logo } from "@/components/shared/logo"
import type { StoreSettings } from "@/features/settings/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { safeExternalUrl } from "@/lib/safe-redirect"
import type { NavCategory } from "./header"
import { InstallButton } from "./install-prompt"
import { WhatsAppIcon } from "./brand-icons"

export function Footer({ categories, shop }: { categories: NavCategory[]; shop: StoreSettings }) {
  const igUrl = safeExternalUrl(shop.instagramUrl)
  const fbUrl = safeExternalUrl(shop.facebookUrl)
  const socials = [
    ...(igUrl ? [{ href: igUrl, label: "Instagram", external: true as const }] : []),
    ...(fbUrl ? [{ href: fbUrl, label: "Facebook", external: true as const }] : []),
  ]
  const columns = [
    {
      title: "Shop",
      links: [
        { href: "/products", label: "All products" },
        ...categories.slice(0, 5).map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
      ],
    },
    {
      title: "Help",
      links: [
        { href: "/track", label: "Track your order" },
        { href: "/account/orders", label: "My orders" },
        { href: "/wishlist", label: "Wishlist" },
        { href: "/contact", label: "Contact us" },
      ],
    },
    {
      title: "About",
      links: [
        { href: "/about", label: "Our story" },
        ...socials,
      ],
    },
  ]

  return (
    <footer
      data-ui="store/Footer"
      data-slot="store-footer"
      className="mt-12 border-t bg-linear-to-b from-secondary/40 to-secondary/80 sm:mt-20"
    >
      <div data-ui="store/Footer/div-grid" className="container-page grid grid-cols-2 gap-6 py-8 sm:gap-12 sm:py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div data-ui="store/Footer/div" className="col-span-2 space-y-3 sm:space-y-4 md:col-span-1">
          <Logo />
          <p data-ui="store/Footer/p" className="max-w-xs text-sm/relaxed  text-muted-foreground">{shop.description}</p>
          {/* Both buttons: same width and height, stacked. */}
          <div data-ui="store/Footer/div-flex" className="flex w-full max-w-56 flex-col gap-2.5">
            <a data-ui="store/Footer/a-chat-on-whatsapp"
              href={shopWhatsappLink(shop, `Hi ${shop.shopName}!`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-whatsapp-solid px-4 text-sm font-semibold text-white shadow-md shadow-whatsapp/25 transition-transform hover:-translate-y-0.5"
            >
              <WhatsAppIcon className="size-4" /> Chat on WhatsApp
            </a>
            <InstallButton className="w-full justify-center" />
          </div>
        </div>
        {columns.map((col) => (
          <nav data-ui="store/Footer/nav" key={col.title} aria-label={col.title}>
            <h2 data-ui="store/Footer/h2" className="mb-4 font-sans text-sm font-semibold tracking-wide uppercase">{col.title}</h2>
            <ul data-ui="store/Footer/ul" className="space-y-2.5">
              {col.links.map((l) => (
                <li data-ui="store/Footer/li" key={l.label}>
                  {"external" in l ? (
                    <a data-ui="store/Footer/a" href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {l.label}
                    </a>
                  ) : (
                    <ScrollLink data-ui="store/Footer/ScrollLink" href={l.href} className="inline-block py-0.5 text-sm text-muted-foreground transition-colors hover:text-primary">
                      {l.label}
                    </ScrollLink>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div data-ui="store/Footer/div-2" className="border-t">
        <div data-ui="store/Footer/div-flex-2" className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <p data-ui="store/Footer/p-2">
            © {shop.shopName}.{shop.city ? ` Handmade in ${shop.city}, India.` : ""}
          </p>
          <p data-ui="store/Footer/p-3">Orders confirmed on WhatsApp · Secure &amp; simple</p>
          <BackToTop className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-medium transition-colors hover:bg-muted hover:text-foreground" />
        </div>
      </div>
    </footer>
  )
}

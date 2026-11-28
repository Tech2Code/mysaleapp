import { BackToTop } from "@/components/shared/back-to-top"
import { CookiePreferencesButton } from "@/components/shared/cookie-banner"
import { ScrollLink } from "@/components/shared/scroll-link"
import { Logo } from "@/components/shared/logo"
import type { StoreSettings } from "@/features/settings/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { safeExternalUrl } from "@/lib/safe-redirect"
import type { NavCategory } from "./header"
import { InstallButton } from "./install-prompt"
import { WhatsAppIcon } from "./brand-icons"
import { buttonVariants } from "@/components/ui/button"
import styles from "./footer.module.css"

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
        { href: "/faq", label: "FAQs" },
        { href: "/account/orders", label: "My orders" },
        { href: "/wishlist", label: "Wishlist" },
        { href: "/contact", label: "Contact us" },
      ],
    },
    {
      title: "About & Policies",
      links: [
        { href: "/about", label: "Our story" },
        { href: "/refund-policy", label: "Refund & return policy" },
        { href: "/privacy", label: "Privacy policy" },
        { href: "/terms", label: "Terms of service" },
        ...socials,
      ],
    },
  ]

  return (
    <footer

      data-slot="store-footer"
      className={styles.storeFooter}
    >
      <div className={styles.footerGrid}>
        <div className={styles.brandColumn}>
          <Logo />
          <p className={styles.shopDescription}>{shop.description}</p>
          {/* Both buttons: same width and height, stacked. */}
          <div className={styles.actionStack}>
            <a
              href={shopWhatsappLink(shop, `Hi ${shop.shopName}!`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "whatsapp", fullWidth: true })}
            >
              <WhatsAppIcon className={styles.whatsappIcon} aria-hidden="true" /> Chat on WhatsApp
            </a>
            <InstallButton className={styles.installBtn} />
          </div>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className={styles.navColumn}>
            <h2 className={styles.columnHeading}>{col.title}</h2>
            <ul className={styles.linkList}>
              {col.links.map((l) => (
                <li key={l.label} className={styles.linkItem}>
                  {"external" in l ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                      {l.label}
                    </a>
                  ) : (
                    <ScrollLink href={l.href} className={styles.internalLink}>
                      {l.label}
                    </ScrollLink>
                  )}
                </li>
              ))}
              {col.title === "About & Policies" && (
                <li className={styles.linkItem}>
                  <CookiePreferencesButton className={styles.internalLink} />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className={styles.bottomSection}>
        <div className={styles.bottomBar}>
          <p className={styles.copyrightText}>
            © {shop.shopName}.{shop.city ? ` Based in ${shop.city}, India.` : ""}
          </p>
          <p className={styles.trustText}>Secure UPI checkout · Tracked doorstep delivery</p>
          <BackToTop className={styles.backToTopBtn} />
        </div>
      </div>
    </footer>
  )
}

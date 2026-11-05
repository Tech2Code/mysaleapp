import Link from "next/link"
import { Logo } from "@/components/shared/logo"
import { siteConfig } from "@/config/site"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import type { NavCategory } from "./header"
import { WhatsAppIcon } from "./brand-icons"

export function Footer({ categories }: { categories: NavCategory[] }) {
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
        { href: siteConfig.socials.instagram, label: "Instagram", external: true },
        { href: siteConfig.socials.facebook, label: "Facebook", external: true },
      ],
    },
  ]

  return (
    <footer className="mt-24 border-t bg-linear-to-b from-secondary/40 to-secondary/80">
      <div className="container-page grid gap-12 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
          <a
            href={shopWhatsappLink(`Hi ${siteConfig.name}!`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-whatsapp px-4 py-2 text-sm font-semibold text-white shadow-md shadow-whatsapp/25 transition-transform hover:-translate-y-0.5"
          >
            <WhatsAppIcon className="size-4" /> Chat on WhatsApp
          </a>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-4 font-sans text-sm font-semibold tracking-wide uppercase">{col.title}</h2>
            <ul className="space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  {"external" in l ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-primary">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {siteConfig.name}. Handmade in {siteConfig.contact.city}, India.
          </p>
          <p>Orders confirmed on WhatsApp · Secure &amp; simple</p>
        </div>
      </div>
    </footer>
  )
}

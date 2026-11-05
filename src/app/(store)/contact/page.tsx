import { MailIcon, MapPinIcon } from "lucide-react"
import type { Metadata } from "next"
import { PageHeader } from "@/components/store/page-header"
import { InstagramIcon, WhatsAppIcon } from "@/components/store/brand-icons"
import { siteConfig } from "@/config/site"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { pageMetadata } from "@/lib/seo"

export const metadata: Metadata = pageMetadata({
  title: "Contact us",
  description: `Get in touch with ${siteConfig.name} on WhatsApp, email or Instagram.`,
  path: "/contact",
})

export default function ContactPage() {
  const cards = [
    {
      icon: WhatsAppIcon,
      title: "WhatsApp",
      text: "Fastest reply — usually within an hour",
      href: shopWhatsappLink(`Hi ${siteConfig.name}!`),
      cta: "Start chat",
    },
    { icon: MailIcon, title: "Email", text: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}`, cta: "Send email" },
    { icon: InstagramIcon, title: "Instagram", text: "See new pieces first", href: siteConfig.socials.instagram, cta: "Follow us" },
  ]

  return (
    <>
      <PageHeader
        title="Contact us"
        description="Questions, custom orders or just saying hello — we'd love to hear from you."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Contact" }]}
      />
      <div className="container-page grid gap-5 pt-12 md:grid-cols-3">
        {cards.map((c) => (
          <a
            key={c.title}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group rounded-3xl border bg-card p-7 transition-all hover:-translate-y-1 hover:shadow-xl"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
              <c.icon className="size-6" />
            </span>
            <h2 className="mt-5 font-sans text-xl font-semibold">{c.title}</h2>
            <p className="mt-1 text-muted-foreground">{c.text}</p>
            <span className="mt-4 inline-block font-semibold text-primary group-hover:underline">{c.cta} →</span>
          </a>
        ))}
        <p className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-3">
          <MapPinIcon className="size-4" /> Studio in {siteConfig.contact.city}, {siteConfig.contact.region}. Shipping across India.
        </p>
      </div>
    </>
  )
}

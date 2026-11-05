import { MailIcon, MapPinIcon, PhoneIcon } from "lucide-react"
import type { Metadata } from "next"
import type { ComponentType, SVGProps } from "react"
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/store/brand-icons"
import { PageHeader } from "@/components/store/page-header"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Contact us",
    description: `Get in touch with ${shop.shopName} on WhatsApp${shop.email ? ", email" : ""}${shop.instagramUrl ? " or Instagram" : ""}.`,
    path: "/contact",
  })
}

type ContactCard = {
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  text: string
  href: string
  cta: string
}

export default async function ContactPage() {
  const shop = await getStoreSettings()

  // Only the details the owner has filled in under Admin → Settings are shown.
  const cards: ContactCard[] = [
    {
      icon: WhatsAppIcon,
      title: "WhatsApp",
      text: "Fastest reply — usually within an hour",
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
      <div className="container-page grid gap-5 pt-8 sm:pt-12 md:grid-cols-2 lg:grid-cols-3">
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
        {place && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
            <MapPinIcon className="size-4" /> Studio in {place}. Shipping across India.
          </p>
        )}
      </div>
    </>
  )
}

import type { Metadata } from "next"
import { ContactView } from "@/components/store/page-views"
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

export default async function ContactPage() {
  return <ContactView shop={await getStoreSettings()} />
}

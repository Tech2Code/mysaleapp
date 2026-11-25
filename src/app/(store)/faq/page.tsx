import type { Metadata } from "next"
import { FaqView } from "@/components/store/faq-view"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Frequently Asked Questions (FAQs)",
    description: `Answers to common questions about ordering, UPI checkout, shipping across India, returns, and custom handmade gifts at ${shop.shopName}.`,
    path: "/faq",
  })
}

export default async function FaqPage() {
  return <FaqView shop={await getStoreSettings()} />
}

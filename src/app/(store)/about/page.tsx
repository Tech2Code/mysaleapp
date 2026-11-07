import type { Metadata } from "next"
import { AboutView } from "@/components/store/page-views"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Our story",
    description: shop.description,
    path: "/about",
  })
}

export default async function AboutPage() {
  return <AboutView shop={await getStoreSettings()} />
}

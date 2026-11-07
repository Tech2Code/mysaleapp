import type { Metadata } from "next"
import { TrackPageView } from "@/components/store/page-views"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Track your order",
    description: `Check the status of your ${shop.shopName} order with your order code.`,
    path: "/track",
    noIndex: true,
  })
}

export default function TrackPage() {
  return <TrackPageView />
}

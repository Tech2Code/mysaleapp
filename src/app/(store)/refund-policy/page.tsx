import type { Metadata } from "next"
import { RefundPolicyView } from "@/components/store/legal-view"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Refund, Return & Shipping Policy",
    description: `Shipping, return, exchange, and refund terms for ${shop.shopName} orders.`,
    path: "/refund-policy",
  })
}

export default async function RefundPolicyPage() {
  return <RefundPolicyView shop={await getStoreSettings()} />
}


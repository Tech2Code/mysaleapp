import type { Metadata } from "next"
import { PrivacyPolicyView } from "@/components/store/legal-view"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Privacy Policy",
    description: `How ${shop.shopName} collects, uses, retains, and protects your personal information.`,
    path: "/privacy",
  })
}

export default async function PrivacyPage() {
  return <PrivacyPolicyView shop={await getStoreSettings()} />
}


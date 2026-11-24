import type { Metadata } from "next"
import { TermsOfServiceView } from "@/components/store/legal-view"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Terms of Service",
    description: `Terms and conditions governing your use of ${shop.shopName} and purchases made on our store.`,
    path: "/terms",
  })
}

export default async function TermsPage() {
  return <TermsOfServiceView shop={await getStoreSettings()} />
}


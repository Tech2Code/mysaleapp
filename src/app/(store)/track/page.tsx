import type { Metadata } from "next"
import { Suspense } from "react"
import { PageHeader } from "@/components/store/page-header"
import { TrackOrder } from "@/components/store/track-order"
import { getStoreSettings } from "@/features/settings/queries"
import { pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Track your order",
    description: `Check the status of your ${shop.shopName} order with your order code.`,
    path: "/track",
  })
}

export default function TrackPage() {
  return (
    <>
      <PageHeader
        title="Track your order"
        description="Enter the order code from your WhatsApp message and the last 4 digits of your phone number."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Track order" }]}
      />
      <div className="container-page pt-10">
        <Suspense>
          <TrackOrder />
        </Suspense>
      </div>
    </>
  )
}

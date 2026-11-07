import type { Metadata } from "next"
import { OrderPlacedPageView } from "@/components/store/page-views"

export const metadata: Metadata = { title: "Order placed", robots: { index: false } }

export default function OrderPlacedPage() {
  return <OrderPlacedPageView />
}

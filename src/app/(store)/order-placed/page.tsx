import type { Metadata } from "next"
import { Suspense } from "react"
import { OrderPlaced } from "@/components/store/order-placed"

export const metadata: Metadata = { title: "Order placed", robots: { index: false } }

export default function OrderPlacedPage() {
  return (
    <section className="bg-hero">
      <div className="container-page py-16 sm:py-24">
        <Suspense>
          <OrderPlaced />
        </Suspense>
      </div>
    </section>
  )
}

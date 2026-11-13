import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { MyOrderView } from "@/components/account/account-views"
import { getMyOrder } from "@/features/orders/queries"
import { returnWindow } from "@/features/orders/returns"
import { getStoreSettings } from "@/features/settings/queries"
import Loading from "./loading"

export const metadata: Metadata = { title: "Order details", robots: { index: false, follow: false } }

export default function MyOrderPage({ params }: PageProps<"/account/orders/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <MyOrderDetails params={params} />
    </Suspense>
  )
}

async function MyOrderDetails({ params }: Pick<PageProps<"/account/orders/[code]">, "params">) {
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code), getStoreSettings()])
  if (!order) notFound()

  return <MyOrderView order={order} shop={shop} win={returnWindow(order.history, shop.returnWindowDays, new Date())} />
}

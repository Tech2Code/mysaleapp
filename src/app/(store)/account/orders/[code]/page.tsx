import { notFound } from "next/navigation"
import { connection } from "next/server"
import { MyOrderView } from "@/components/account/account-views"
import { getMyOrder } from "@/features/orders/queries"
import { returnWindow } from "@/features/orders/returns"
import { getStoreSettings } from "@/features/settings/queries"

export default async function MyOrderPage({ params }: PageProps<"/account/orders/[code]">) {
  await connection()
  const { code } = await params
  const [order, shop] = await Promise.all([getMyOrder(code), getStoreSettings()])
  if (!order) notFound()

  return <MyOrderView order={order} shop={shop} win={returnWindow(order.history, shop.returnWindowDays, new Date())} />
}

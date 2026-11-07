import { MyOrdersView } from "@/components/account/account-views"
import { getMyOrders } from "@/features/orders/queries"
import { getStoreSettings } from "@/features/settings/queries"

export default async function MyOrdersPage() {
  const [orders, shop] = await Promise.all([getMyOrders(), getStoreSettings()])
  return <MyOrdersView orders={orders} shop={shop} />
}

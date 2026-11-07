import { MyOrdersView } from "@/components/account/account-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrders } from "@/features/orders/placeholders"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

// /account redirects to /account/orders, so the orders list is the generic account loading state.
export default function Loading() {
  return (
    <Skeletonize>
      <MyOrdersView orders={placeholderOrders(3)} shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

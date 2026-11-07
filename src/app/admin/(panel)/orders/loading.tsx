import { OrdersView } from "@/components/admin/orders-view"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrders } from "@/features/orders/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <OrdersView orders={placeholderOrders(20)} total={20} page={1} pages={1} filters={{}} />
    </Skeletonize>
  )
}

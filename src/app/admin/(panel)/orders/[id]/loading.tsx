import { AdminOrderView } from "@/components/admin/order-view"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderOrderWithHistory } from "@/features/orders/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <AdminOrderView order={placeholderOrderWithHistory()} autoCancelAt={null} />
    </Skeletonize>
  )
}

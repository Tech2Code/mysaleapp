import { Skeletonize } from "@/components/shared/skeletonize"
import { OrderPlacedPageView } from "@/components/store/page-views"

export default function Loading() {
  return (
    <Skeletonize>
      <OrderPlacedPageView preview />
    </Skeletonize>
  )
}

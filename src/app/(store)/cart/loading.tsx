import { Skeletonize } from "@/components/shared/skeletonize"
import { CartPageView } from "@/components/store/page-views"

export default function Loading() {
  return (
    <Skeletonize>
      <CartPageView products={[]} preview />
    </Skeletonize>
  )
}

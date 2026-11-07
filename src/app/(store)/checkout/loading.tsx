import { Skeletonize } from "@/components/shared/skeletonize"
import { CheckoutPageView } from "@/components/store/page-views"

export default function Loading() {
  return (
    <Skeletonize>
      <CheckoutPageView products={[]} preview />
    </Skeletonize>
  )
}

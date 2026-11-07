import { Skeletonize } from "@/components/shared/skeletonize"
import { WishlistPageView } from "@/components/store/page-views"

export default function Loading() {
  return (
    <Skeletonize>
      <WishlistPageView products={[]} preview />
    </Skeletonize>
  )
}

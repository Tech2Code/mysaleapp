import { Skeletonize } from "@/components/shared/skeletonize"
import { TrackPageView } from "@/components/store/page-views"

export default function Loading() {
  return (
    <Skeletonize>
      <TrackPageView />
    </Skeletonize>
  )
}

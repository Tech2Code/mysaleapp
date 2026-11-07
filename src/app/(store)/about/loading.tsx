import { Skeletonize } from "@/components/shared/skeletonize"
import { AboutView } from "@/components/store/page-views"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <AboutView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

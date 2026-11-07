import { LaunchView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderChecklist, placeholderLaunchCounts } from "@/features/settings/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <LaunchView counts={placeholderLaunchCounts()} checklist={placeholderChecklist()} />
    </Skeletonize>
  )
}

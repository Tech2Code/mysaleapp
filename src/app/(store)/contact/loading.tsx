import { Skeletonize } from "@/components/shared/skeletonize"
import { ContactView } from "@/components/store/page-views"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <ContactView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

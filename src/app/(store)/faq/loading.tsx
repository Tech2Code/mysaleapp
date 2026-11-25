import { Skeletonize } from "@/components/shared/skeletonize"
import { FaqView } from "@/components/store/faq-view"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <FaqView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

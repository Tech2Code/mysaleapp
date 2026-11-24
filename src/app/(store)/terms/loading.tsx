import { Skeletonize } from "@/components/shared/skeletonize"
import { TermsOfServiceView } from "@/components/store/legal-view"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <TermsOfServiceView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}


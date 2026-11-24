import { Skeletonize } from "@/components/shared/skeletonize"
import { PrivacyPolicyView } from "@/components/store/legal-view"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <PrivacyPolicyView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}


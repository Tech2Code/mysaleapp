import { Skeletonize } from "@/components/shared/skeletonize"
import { RefundPolicyView } from "@/components/store/legal-view"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <RefundPolicyView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}


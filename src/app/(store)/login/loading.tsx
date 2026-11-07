import { Skeletonize } from "@/components/shared/skeletonize"
import { LoginView } from "@/components/store/page-views"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <LoginView shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

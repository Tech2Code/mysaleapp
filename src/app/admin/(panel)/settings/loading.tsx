import { SettingsView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <SettingsView settings={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

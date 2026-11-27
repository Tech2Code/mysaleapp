import { SettingsView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { DEFAULT_EMAIL_SETTINGS } from "@/features/email/schema"
import { DEFAULT_PROMO_CODES, DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <SettingsView
        settings={DEFAULT_SETTINGS}
        promoCodes={DEFAULT_PROMO_CODES}
        emailSettings={DEFAULT_EMAIL_SETTINGS}
      />
    </Skeletonize>
  )
}

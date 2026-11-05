import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { StoreSettingsForm } from "@/components/admin/store-settings-form"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const settings = await getStoreSettings()
  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Your shop's name, contact details, payment, delivery and SEO. Changes go live on the website as soon as you save."
      />
      <StoreSettingsForm settings={settings} />
    </>
  )
}

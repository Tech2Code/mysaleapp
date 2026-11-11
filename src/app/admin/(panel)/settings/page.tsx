import type { Metadata } from "next"
import { SettingsView } from "@/components/admin/page-views"
import { requireAdmin } from "@/features/auth/guards"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const [, settings] = await Promise.all([requireAdmin(), getStoreSettings()])
  return <SettingsView settings={settings} />
}

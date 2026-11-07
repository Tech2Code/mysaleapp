import type { Metadata } from "next"
import { SettingsView } from "@/components/admin/page-views"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  return <SettingsView settings={await getStoreSettings()} />
}

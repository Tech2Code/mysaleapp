import type { Metadata } from "next"
import { SettingsView } from "@/components/admin/page-views"
import { requireAdmin } from "@/features/auth/guards"
import { listConfiguredGateways } from "@/features/orders/payment-gateway"
import { getStoreSettings, listPromoCodes } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const [, settings, promoCodes] = await Promise.all([requireAdmin(), getStoreSettings(), listPromoCodes()])
  const configuredGateways = listConfiguredGateways()
  return <SettingsView settings={settings} promoCodes={promoCodes} configuredGateways={configuredGateways} />
}

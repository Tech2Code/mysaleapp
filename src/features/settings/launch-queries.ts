import "server-only"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { DEFAULT_SETTINGS } from "./defaults"
import { getStoreSettings } from "./queries"
import { gstActive } from "./tax"
import type { LaunchCounts } from "./launch"

const PLACEHOLDER_WHATSAPP = "919999999999"

export type ChecklistItem = { label: string; done: boolean; href: string; hint: string; /** true = a Settings value that still holds a placeholder */ settings?: boolean }

/** How much data exists now, plus a "ready to launch?" checklist. */
export async function getLaunchOverview(): Promise<{ counts: LaunchCounts; checklist: ChecklistItem[] }> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const count = (table: string) => supabase.from(table).select("*", { count: "exact", head: true })

  const [orders, products, categories, addresses, wishlists, settings] = await Promise.all([
    count("orders"),
    count("products"),
    count("categories"),
    count("addresses"),
    count("wishlists"),
    getStoreSettings(),
  ])

  const counts: LaunchCounts = {
    orders: orders.count ?? 0,
    products: products.count ?? 0,
    categories: categories.count ?? 0,
    addresses: addresses.count ?? 0,
    wishlists: wishlists.count ?? 0,
  }

  const checklist: ChecklistItem[] = [
    { settings: true, label: "Shop name", done: settings.shopName.trim() !== "" && settings.shopName !== DEFAULT_SETTINGS.shopName, href: "/admin/settings", hint: `Still the placeholder "${DEFAULT_SETTINGS.shopName}"` },
    { settings: true, label: "Tagline and description", done: settings.tagline !== DEFAULT_SETTINGS.tagline && settings.description !== DEFAULT_SETTINGS.description, href: "/admin/settings", hint: "Still the sample text" },
    { settings: true, label: "WhatsApp number", done: settings.whatsappNumber !== PLACEHOLDER_WHATSAPP && !settings.whatsappNumber.startsWith("999999"), href: "/admin/settings", hint: "Still the placeholder number, orders would go nowhere" },
    { settings: true, label: "UPI ID for payments", done: Boolean(settings.upiId?.trim()) && settings.upiId !== DEFAULT_SETTINGS.upiId, href: "/admin/settings", hint: "Customers can't pay without it" },
    { settings: true, label: "Contact email", done: Boolean(settings.email?.trim()), href: "/admin/settings", hint: "Not set. Shown in the footer and on Google" },
    { settings: true, label: "Contact phone", done: settings.phoneSameAsWhatsapp ? !settings.whatsappNumber.startsWith("999999") : Boolean(settings.phone?.trim()) && !/9{6}/.test(settings.phone ?? ""), href: "/admin/settings", hint: "Not set, or still a sample number" },
    { settings: true, label: "City", done: Boolean(settings.city?.trim()), href: "/admin/settings", hint: "Not set. Shown in the footer and on Google" },
    ...(settings.gstRegistered ? [{ settings: true, label: "GST details", done: gstActive(settings), href: "/admin/settings", hint: "GST is on but the GSTIN or rate is missing" }] : []),
    { label: "At least one product", done: counts.products > 0, href: "/admin/products/new", hint: "Your store is empty" },
    { label: "Your admin login email", done: true, href: "/admin/account", hint: "Change it under My account" },
  ]

  return { counts, checklist }
}

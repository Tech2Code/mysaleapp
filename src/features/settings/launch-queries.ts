import "server-only"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { DEFAULT_SETTINGS } from "./defaults"
import { getStoreSettings } from "./queries"
import type { LaunchCounts } from "./launch"

export type ChecklistItem = { label: string; done: boolean; href: string; hint: string }

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
    { label: "Shop name and description", done: settings.shopName !== DEFAULT_SETTINGS.shopName || settings.description !== DEFAULT_SETTINGS.description, href: "/admin/settings", hint: "Still the starter text" },
    { label: "WhatsApp number", done: settings.whatsappNumber !== DEFAULT_SETTINGS.whatsappNumber && !settings.whatsappNumber.startsWith("999999"), href: "/admin/settings", hint: "Still the placeholder number" },
    { label: "UPI ID for payments", done: Boolean(settings.upiId), href: "/admin/settings", hint: "Customers can't pay without it" },
    { label: "Contact email and city", done: Boolean(settings.email && settings.city), href: "/admin/settings", hint: "Shown in the footer and on Google" },
    { label: "At least one product", done: counts.products > 0, href: "/admin/products/new", hint: "Your store is empty" },
    { label: "Your admin login email", done: true, href: "/admin/account", hint: "Change it under My account" },
  ]

  return { counts, checklist }
}

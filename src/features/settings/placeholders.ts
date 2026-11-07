import type { LaunchCounts } from "./launch"
import type { ChecklistItem } from "./launch-queries"

/** Placeholder data for loading states (see components/shared/skeletonize.tsx). Settings use DEFAULT_SETTINGS. */

export const placeholderLaunchCounts = (): LaunchCounts => ({ orders: 12, products: 24, categories: 5, addresses: 8, wishlists: 6 })

/** The same 9 rows the real checklist has without GST (7 settings + product + admin login). */
export const placeholderChecklist = (): ChecklistItem[] =>
  [
    "Shop name",
    "Tagline and description",
    "WhatsApp number",
    "UPI ID for payments",
    "Contact email",
    "Contact phone",
    "City",
    "At least one product",
    "Your admin login email",
  ].map((label, i) => ({ label, done: i > 6, settings: i < 7, href: "/admin/settings", hint: "A short hint about what to do next" }))

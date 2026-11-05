/**
 * Deployment-level constants only.
 *
 * The shop's name, tagline, contact details, WhatsApp number, social links, SEO keywords,
 * delivery charges, UPI details and order-code prefix are NOT here. The owner edits them in
 * Admin → Settings (stored in the database). Their starting values are in
 * src/features/settings/defaults.ts.
 */
export const siteConfig = {
  /** Public URL of the site (no trailing slash). Set NEXT_PUBLIC_SITE_URL per environment. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_IN",
  currency: "INR",
  country: "IN",
} as const

export type SiteConfig = typeof siteConfig

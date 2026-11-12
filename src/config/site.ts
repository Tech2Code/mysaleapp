/**
 * Deployment-level constants only.
 *
 * The shop's name, tagline, contact details, WhatsApp number, social links, SEO keywords,
 * delivery charges, UPI details and order-code prefix are NOT here. The owner edits them in
 * Admin → Settings (stored in the database). Their starting values are in
 * src/features/settings/defaults.ts.
 */
function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "")
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  const vercelUrl = process.env.VERCEL_URL?.trim()

  // If NEXT_PUBLIC_SITE_URL is set to a real non-localhost domain, prefer it
  if (configured && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) {
    return configured
  }
  // On Vercel, automatically use the production domain (e.g. https://mysaleapp-one.vercel.app) even if NEXT_PUBLIC_SITE_URL was left blank or localhost
  if (vercelProd) return `https://${vercelProd.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
  if (vercelUrl) return `https://${vercelUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
  return configured || "http://localhost:3000"
}

export const siteConfig = {
  /** Public URL of the site (no trailing slash). Set NEXT_PUBLIC_SITE_URL per environment. */
  url: resolveSiteUrl(),
  locale: "en_IN",
  currency: "INR",
  country: "IN",
} as const

export type SiteConfig = typeof siteConfig

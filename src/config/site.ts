/**
 * Single place to edit shop identity, contact details and SEO defaults.
 * Everything that says "your shop" anywhere in the app reads from here.
 */
export const siteConfig = {
  name: "Kalakriti",
  shortName: "Kalakriti",
  tagline: "Handmade gifts & decor, crafted with love",
  description:
    "Shop handmade gifts, home decor, candles and wall art crafted by Indian artisans. Order easily on WhatsApp with fast delivery across India.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  locale: "en_IN",
  currency: "INR",
  /** Digits only, with country code. Example: 919876543210 */
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919999999999",
  /** Prefix for order codes, e.g. KK-7F3K9Q */
  orderCodePrefix: "KK",
  keywords: [
    "handmade gifts",
    "handmade home decor",
    "handcrafted gifts online India",
    "artisan decor",
    "personalised gifts",
    "scented candles",
    "wall art",
  ],
  contact: {
    email: "hello@example.com",
    phone: "+91 99999 99999",
    city: "Jaipur",
    region: "Rajasthan",
    country: "IN",
  },
  socials: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
  },
  /** Free-delivery threshold shown in cart (₹). Set to 0 to hide. */
  freeShippingAbove: 999,
} as const

export type SiteConfig = typeof siteConfig

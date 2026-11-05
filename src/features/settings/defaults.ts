import type { StoreSettings } from "./types"

/**
 * Starting values, used until the owner saves them in Admin → Settings (and in demo mode).
 * Safe to import from client components.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  shopName: "Kalakriti",
  tagline: "Handmade gifts & decor, crafted with love",
  description:
    "Shop handmade gifts, home decor, candles and wall art crafted by Indian artisans. Pay securely by UPI with fast delivery across India.",
  keywords: [
    "handmade gifts",
    "handmade home decor",
    "handcrafted gifts online India",
    "artisan decor",
    "personalised gifts",
    "scented candles",
    "wall art",
  ],
  announcement: null,

  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919999999999",
  email: null,
  phone: null,
  phoneSameAsWhatsapp: true,
  city: null,
  region: null,
  instagramUrl: null,
  facebookUrl: null,

  orderCodePrefix: "KK",

  unpaidOrderExpiryHours: 24,
  deliveryFee: 60,
  freeDeliveryAbove: 999,

  upiId: null,
  upiPayeeName: null,
}

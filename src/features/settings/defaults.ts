import { DEFAULT_CUSTOM_THEME, DEFAULT_THEME_PRESET } from "./theme"
import type { PromoCode, StoreSettings } from "./types"

export const DEFAULT_PROMO_CODES: PromoCode[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    code: "WELCOME10",
    description: "10% off on your first order",
    discountType: "percent",
    discountValue: 10,
    minOrderAmount: 499,
    maxDiscountAmount: 200,
    maxUses: 100,
    usedCount: 12,
    isActive: true,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
]

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
  highlightLine: "Handmade by skilled artisans",
  heroBadge: "Handmade in India · Made to be gifted",
  priceNote: null,

  gstRegistered: false,
  gstin: null,
  gstRate: 0,
  legalName: null,
  businessAddress: null,

  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "919999999999",
  email: null,
  phone: null,
  phoneSameAsWhatsapp: true,
  city: null,
  region: null,
  pincode: null,
  instagramUrl: null,
  facebookUrl: null,

  orderCodePrefix: "KK",

  unpaidOrderExpiryHours: 24,
  returnWindowDays: 7,
  deliveryFee: 60,
  freeDeliveryAbove: 999,
  fragileFee: 30,
  oversizedFee: 80,
  freeWeightGrams: 1000,
  extraWeightFeePerKg: 40,

  paymentMode: "manual_upi",
  paymentGateway: "razorpay",
  upiId: null,
  upiPayeeName: null,

  themePreset: DEFAULT_THEME_PRESET,
  themeCustom: DEFAULT_CUSTOM_THEME,
}

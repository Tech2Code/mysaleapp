import { z } from "zod"
import { LIMITS, v } from "@/lib/validation"
import { requiredNumber } from "@/lib/zod-helpers"

/** 10-digit Indian numbers get +91 added; anything else must already include the country code. */
export function normalizeWhatsappNumber(input: string): string {
  const digits = input.replace(/\D/g, "")
  return /^[6-9]\d{9}$/.test(digits) ? `91${digits}` : digits
}

export const storeSettingsSchema = z.object({
  // ---- Shop profile & SEO ----
  shopName: z
    .string()
    .trim()
    .min(LIMITS.shopName.min, "Enter your shop name")
    .max(LIMITS.shopName.max, `Keep it under ${LIMITS.shopName.max} characters`),
  tagline: z
    .string()
    .trim()
    .min(LIMITS.tagline.min, "Enter a short tagline")
    .max(LIMITS.tagline.max, `Keep it under ${LIMITS.tagline.max} characters`),
  description: z
    .string()
    .trim()
    .min(LIMITS.shopDescription.min, "Write a sentence or two")
    .max(LIMITS.shopDescription.max, `Keep it under ${LIMITS.shopDescription.max} characters (Google shows about 155)`),
  /** Comma-separated; split when read. */
  keywords: z.string().trim().max(LIMITS.keywords.max, "Too long"),
  announcement: v.optionalText(LIMITS.announcement.max),

  // ---- Contact ----
  whatsappNumber: z
    .string()
    .transform(normalizeWhatsappNumber)
    .refine(
      (n) => n.length >= LIMITS.intlPhone.min && n.length <= LIMITS.intlPhone.max,
      "Enter a valid 10-digit WhatsApp number"
    ),
  /** true = calling number is the WhatsApp number; `phone` is then ignored. */
  phoneSameAsWhatsapp: z.boolean(),
  email: v.optionalEmail(),
  phone: v.optionalText(LIMITS.displayPhone.max),
  city: v.optionalText(LIMITS.city.max),
  region: v.optionalText(LIMITS.region.max),
  instagramUrl: v.optionalUrl("Instagram link"),
  facebookUrl: v.optionalUrl("Facebook link"),

  // ---- Orders ----
  orderCodePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{1,5}$/, `${LIMITS.orderPrefix.min} to ${LIMITS.orderPrefix.max} letters, like KK`),

  // ---- Delivery ----
  deliveryFee: v.money(LIMITS.deliveryFee.max, "Enter the delivery charge"),
  freeDeliveryAbove: v.money(LIMITS.money.max, "Enter an amount (0 = never free)"),

  // ---- Payment ----
  upiId: z.preprocess(
    (x) => (typeof x === "string" && x.trim() === "" ? null : x),
    v.upiId().nullable()
  ),
  upiPayeeName: v.optionalText(LIMITS.payeeName.max).pipe(
    z.string().min(LIMITS.payeeName.min, "Too short").nullable()
  ),
})

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>
export type StoreSettingsValues = z.output<typeof storeSettingsSchema>

// kept for existing imports
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$/
void requiredNumber

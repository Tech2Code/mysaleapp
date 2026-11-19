import { z } from "zod"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS, PATTERNS, todayIST, v } from "@/lib/validation"
import { requiredNumber } from "@/lib/zod-helpers"

/** 10-digit Indian numbers (including +91 / 0 prefixes) get 91 added; anything else must already include the country code. */
export function normalizeWhatsappNumber(input: string): string {
  const indian = normalizeIndianPhone(input)
  if (indian) return `91${indian}`
  return input.replace(/\D/g, "")
}

/** 2-digit state code + PAN + entity number + Z + check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

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
  /** Empty = use the built-in default text. */
  highlightLine: v.optionalText(LIMITS.highlightText.max).pipe(z.string().min(LIMITS.highlightText.min, "Too short").nullable()),
  heroBadge: v.optionalText(LIMITS.highlightText.max).pipe(z.string().min(LIMITS.highlightText.min, "Too short").nullable()),
  priceNote: v.optionalText(LIMITS.priceNote.max).pipe(z.string().min(LIMITS.priceNote.min, "Too short").nullable()),

  // ---- Tax & invoices ----
  gstRegistered: z.boolean(),
  gstin: z.preprocess(
    (x) => (typeof x === "string" ? x.trim().toUpperCase() || null : x),
    z.string().regex(GSTIN_PATTERN, `Enter the ${LIMITS.gstin}-character GSTIN`).nullable()
  ),
  gstRate: v.money(LIMITS.gstRate.max, "Enter the GST rate, e.g. 12"),
  legalName: v.optionalText(LIMITS.legalName.max),
  businessAddress: v.optionalText(LIMITS.businessAddress.max),

  // ---- Contact ----
  whatsappNumber: z
    .string()
    .transform(normalizeWhatsappNumber)
    .refine(
      (n) => /^[1-9]\d+$/.test(n) && n.length >= LIMITS.intlPhone.min && n.length <= LIMITS.intlPhone.max,
      "Enter a valid 10-digit WhatsApp number"
    ),
  /** true = calling number is the WhatsApp number; `phone` is then ignored. */
  phoneSameAsWhatsapp: z.boolean(),
  email: v.optionalEmail(),
  phone: v.optionalDisplayPhone(),
  city: v.optionalText(LIMITS.city.max),
  region: v.optionalText(LIMITS.region.max),
  instagramUrl: v.optionalUrl("Instagram link"),
  facebookUrl: v.optionalUrl("Facebook link"),

  // ---- Orders ----
  orderCodePrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PATTERNS.orderPrefix, `${LIMITS.orderPrefix.min} to ${LIMITS.orderPrefix.max} letters, like KK`),

  unpaidOrderExpiryHours: v.wholeNumber(LIMITS.unpaidExpiryHours.max, "Enter hours (0 = never cancel)"),
  returnWindowDays: v.wholeNumber(LIMITS.returnWindowDays.max, "Enter days (0 = no returns)"),

  // ---- Delivery & smart handling ----
  deliveryFee: v.money(LIMITS.deliveryFee.max, "Enter the delivery charge"),
  freeDeliveryAbove: v.money(LIMITS.money.max, "Enter an amount (0 = never free)"),
  fragileFee: v.money(LIMITS.deliveryFee.max, "Enter the fragile packaging fee (0 = free)"),
  oversizedFee: v.money(LIMITS.deliveryFee.max, "Enter the bulky handling fee (0 = free)"),
  freeWeightGrams: v.wholeNumber(LIMITS.weightGrams.max, "Enter base weight in grams"),
  extraWeightFeePerKg: v.money(LIMITS.deliveryFee.max, "Enter the rate per extra kg (0 = free)"),

  // ---- Payment ----
  upiId: z.preprocess(
    (x) => (typeof x === "string" && x.trim() === "" ? null : x),
    v.upiId().nullable()
  ),
  upiPayeeName: v.optionalText(LIMITS.payeeName.max).pipe(
    z.string().min(LIMITS.payeeName.min, "Too short").nullable()
  ),
}).superRefine((s, ctx) => {
  if (!s.gstRegistered) return
  if (!s.gstin) ctx.addIssue({ code: "custom", path: ["gstin"], message: "Enter your GSTIN" })
  if (!(s.gstRate > 0)) ctx.addIssue({ code: "custom", path: ["gstRate"], message: "Enter the GST rate, e.g. 12" })
})

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>
export type StoreSettingsValues = z.output<typeof storeSettingsSchema>

// kept for existing imports
export const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,64}@[A-Za-z0-9]{2,32}$/
void requiredNumber

export const PROMO_CODE_PATTERN = /^[A-Z0-9_-]{3,24}$/

const optionalPositiveMoney = (max: number, label: string) =>
  z.preprocess(
    (x) => (x === "" || x == null ? null : typeof x === "string" ? Number(x.trim()) : x),
    z
      .number({ error: label })
      .positive(label)
      .max(max, `At most ₹${max.toLocaleString("en-IN")}`)
      .refine((n) => Math.round(n * 100) === n * 100, "Up to 2 decimal places")
      .nullable()
  )

const optionalPositiveInt = (max: number, label: string) =>
  z.preprocess(
    (x) => (x === "" || x == null ? null : typeof x === "string" ? Number(x.trim()) : x),
    z
      .number({ error: label })
      .int("Enter a whole number")
      .positive(label)
      .max(max, `At most ${max.toLocaleString("en-IN")}`)
      .nullable()
  )

export const createPromoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(PROMO_CODE_PATTERN, "Use 3–24 letters, numbers, hyphens or underscores (e.g. WELCOME10)"),
    description: v.optionalText(140),
    discountType: z.enum(["percent", "flat"]),
    discountValue: v.money(50000, "Enter the discount value"),
    minOrderAmount: v.money(LIMITS.money.max, "Enter the minimum order amount (0 = none)"),
    maxDiscountAmount: optionalPositiveMoney(50000, "Enter a positive maximum discount cap"),
    maxUses: optionalPositiveInt(100000, "Enter a positive usage limit"),
    expiresAt: z.preprocess(
      (x) => (typeof x === "string" && x.trim() === "" ? null : x),
      v.isoDate().refine((d) => d >= todayIST(), "Pick today or a future expiry date").nullable()
    ),
  })
  .superRefine((val, ctx) => {
    if (val.discountValue <= 0) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Discount must be greater than 0" })
    }
    if (val.discountType === "percent" && (val.discountValue < 1 || val.discountValue > 90)) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Percentage discount must be between 1% and 90%",
      })
    }
    if (val.discountType === "flat" && val.minOrderAmount > 0 && val.minOrderAmount <= val.discountValue) {
      ctx.addIssue({
        code: "custom",
        path: ["minOrderAmount"],
        message: "Minimum order must be greater than the flat ₹ discount",
      })
    }
  })

export type CreatePromoCodeInput = z.input<typeof createPromoCodeSchema>
export type CreatePromoCodeValues = z.output<typeof createPromoCodeSchema>

export const togglePromoCodeSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
})

export const deletePromoCodeSchema = z.object({
  id: z.uuid(),
})

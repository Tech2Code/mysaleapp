import { z } from "zod"
import { supabaseConfig } from "@/lib/supabase/config"
import { LIMITS, v } from "@/lib/validation"
import { SHIPPING_CLASSES, type ShippingClass } from "./types"

const slug = v.slug()

/** Product images must live in our own Supabase Storage bucket, with no traversal or query/hash parts. */
const imageUrl = z
  .url()
  .refine((u) => {
    try {
      const base = new URL(supabaseConfig.url)
      const parsed = new URL(u)
      if (parsed.origin !== base.origin || parsed.search || parsed.hash) return false
      const prefix = "/storage/v1/object/public/product-images/"
      if (!parsed.pathname.startsWith(prefix)) return false
      const key = decodeURIComponent(parsed.pathname.slice(prefix.length))
      return Boolean(key) && !key.split("/").some((seg) => seg === "." || seg === ".." || seg === "")
    } catch {
      return false
    }
  }, "Image must be uploaded through the admin panel")

/** Choices for a product's physical handling & size class (rates live centrally in Store Settings). */
export const SHIPPING_CLASS_OPTIONS: { value: ShippingClass; label: string }[] = [
  { value: "standard", label: "Standard parcel" },
  { value: "fragile", label: "Fragile item (protective packaging)" },
  { value: "oversized", label: "Large / bulky item (special handling)" },
]

export const MAX_HIGHLIGHTS = 6
export const MAX_SPECS = 10
export const MAX_REVIEW_ASPECTS = 8
export const MAX_VARIANTS = 60

/** Comma-separated (or array) review aspect labels → normalized unique array in the database. */
const reviewAspectList = z
  .preprocess((x) => (Array.isArray(x) ? x.join(", ") : x ?? ""), z.string())
  .pipe(z.string().max(400, "Too long"))
  .transform((raw) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      const key = part.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(part)
    }
    return out
  })
  .pipe(
    z
      .array(z.string().max(40, "Keep each option under 40 characters"))
      .max(MAX_REVIEW_ASPECTS, `Up to ${MAX_REVIEW_ASPECTS} options`)
  )

/** Suggested spec names for the product form. */
export const SPEC_SUGGESTIONS = ["Material", "Size", "Weight", "Colour", "Made in", "Finish", "Includes", "Burn time"]

/** One highlight per line in the form → array in the database. */
const highlightLines = z
  // The form sends the already-split array (resolver output) back to the server action, so accept
  // both shapes; otherwise re-parsing fails with "expected string, received array".
  .preprocess((x) => (Array.isArray(x) ? x.join("\n") : x), z.string())
  .pipe(z.string().max(LIMITS.highlightsText.max, "Too long"))
  .transform((v) =>
    v
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  )
  .pipe(
    z
      .array(z.string().max(LIMITS.highlight.max, `Keep each point under ${LIMITS.highlight.max} characters`))
      .max(MAX_HIGHLIGHTS, `Up to ${MAX_HIGHLIGHTS} points`)
  )

const specSchema = z.object({
  label: z.string().trim().min(1, "Name this detail").max(LIMITS.specLabel.max, "Too long"),
  value: z.string().trim().min(1, "Enter the value").max(LIMITS.specValue.max, "Too long"),
})

const variantSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1, "Enter option name (e.g. Black / M)").max(80, "Keep option name under 80 characters"),
    options: z.record(z.string().trim().min(1).max(30), z.string().trim().min(1).max(40)).optional(),
    price: v.money(LIMITS.money.max, "Price is required").refine((n) => n >= 1, "Price must be at least ₹1"),
    compareAtPrice: v.optionalMoney(LIMITS.money.max).optional(),
    stock: v.wholeNumber(LIMITS.stock.max, "Stock is required"),
    sku: z.preprocess(
      (x) => (typeof x === "string" && x.trim() === "" ? null : x),
      z.string().trim().max(40, "Keep SKU under 40 characters").nullable().optional()
    ),
  })
  .refine((vr) => vr.compareAtPrice == null || vr.compareAtPrice > vr.price, {
    message: "MRP must be higher than variant price",
    path: ["compareAtPrice"],
  })

export const productSchema = z
  .object({
    name: z.string().trim().min(LIMITS.productName.min, "Name is too short").max(LIMITS.productName.max, `Keep it under ${LIMITS.productName.max} characters`),
    slug,
    description: z.string().trim().max(LIMITS.productDescription.max, `Keep it under ${LIMITS.productDescription.max} characters`).default(""),
    price: v.money(LIMITS.money.max, "Price is required").refine((n) => n >= 1, "Selling price must be at least ₹1"),
    compareAtPrice: v.optionalMoney(LIMITS.money.max),
    images: z.array(imageUrl).max(8, "Up to 8 images"),
    categoryId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    stock: v.wholeNumber(LIMITS.stock.max, "Stock is required"),
    weightGrams: z.preprocess(
      (x) => (x === "" || x === null || x === undefined ? 0 : x),
      v.wholeNumber(LIMITS.weightGrams.max, "Enter weight in grams (0 = standard)")
    ),
    shippingClass: z.enum(SHIPPING_CLASSES).default("standard"),
    returnWindowDays: z
      .preprocess(
        (x) => (x === "" || x === null || x === undefined ? null : typeof x === "string" ? Number(x.trim()) : x),
        z
          .number({ error: "Enter 0 to 90 days" })
          .int("Whole days only")
          .min(0, "Can't be negative")
          .max(LIMITS.returnWindowDays.max, `At most ${LIMITS.returnWindowDays.max} days`)
          .nullable()
      )
      .optional(),
    shortDescription: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(LIMITS.shortDescription.max, `Keep it under ${LIMITS.shortDescription.max} characters`).nullable()
    ),
    highlights: highlightLines,
    specs: z.array(specSchema).max(MAX_SPECS, `Up to ${MAX_SPECS} details`).default([]),
    variants: z.array(variantSchema).max(MAX_VARIANTS, `Up to ${MAX_VARIANTS} variants`).default([]),
    careInstructions: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(LIMITS.careInstructions.max, `Keep it under ${LIMITS.careInstructions.max} characters`).nullable()
    ),
    reviewAspects: reviewAspectList.default([]),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().max(LIMITS.seoTitle.max, `Keep under ${LIMITS.seoTitle.max} characters`).nullable().optional(),
    seoDescription: z.string().trim().max(LIMITS.seoDescription.max, `Keep under ${LIMITS.seoDescription.max} characters`).nullable().optional(),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "MRP must be higher than the selling price",
    path: ["compareAtPrice"],
  })

export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(LIMITS.categoryName.min, "Name is too short").max(LIMITS.categoryName.max, `Keep it under ${LIMITS.categoryName.max} characters`),
  slug,
  description: z.string().trim().max(LIMITS.categoryDescription.max, `Keep it under ${LIMITS.categoryDescription.max} characters`).default(""),
  sort: v.wholeNumber(LIMITS.sortOrder.max, "Required"),
  reviewAspects: reviewAspectList.default([]),
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>

export const productReviewSchema = z.object({
  productId: z.uuid(),
  rating: z
    .number({ error: "Select a star rating from 1 to 5" })
    .int("Select a whole star rating")
    .min(1, "Select a star rating from 1 to 5")
    .max(5, "Select a star rating from 1 to 5"),
  title: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(400, "Keep the headline under 400 characters").nullable().optional()
  ),
  comment: z
    .string()
    .trim()
    .min(5, "Write at least 5 characters about this product")
    .max(800, "Keep your review under 800 characters"),
})

export type ProductReviewInput = z.input<typeof productReviewSchema>
export type ProductReviewValues = z.output<typeof productReviewSchema>

export const stockAlertSchema = z.object({
  productId: z.uuid("Invalid product"),
  name: z
    .string()
    .trim()
    .max(LIMITS.personName.max, `Keep your name under ${LIMITS.personName.max} characters`)
    .optional()
    .default(""),
  phone: v.phoneIN(),
})

export type StockAlertInput = z.input<typeof stockAlertSchema>
export type StockAlertValues = z.output<typeof stockAlertSchema>

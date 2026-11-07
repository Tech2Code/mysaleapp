import { z } from "zod"
import { supabaseConfig } from "@/lib/supabase/config"
import { LIMITS, v } from "@/lib/validation"
import { optionalNumber, requiredNumber } from "@/lib/zod-helpers"

const slug = v.slug()

/** Product images must live in our own Supabase Storage bucket. */
const imageUrl = z
  .url()
  .refine(
    (u) => u.startsWith(`${supabaseConfig.url}/storage/v1/object/public/product-images/`),
    "Image must be uploaded through the admin panel"
  )

/** Suggested names for per-item extra charges in the product form. */
export const FEE_SUGGESTIONS = [
  "Handling charge",
  "Packaging charge",
  "Fragile item handling",
  "Gift wrap",
  "Insurance",
]

export const MAX_FEES_PER_PRODUCT = 5
export const MAX_HIGHLIGHTS = 6
export const MAX_SPECS = 10

/** Suggested spec names for the product form. */
export const SPEC_SUGGESTIONS = ["Material", "Size", "Weight", "Colour", "Made in", "Finish", "Includes", "Burn time"]

/** One highlight per line in the form → array in the database. */
const highlightLines = z
  // The form sends the already-split array (resolver output) back to the server action, so accept
  // both shapes; otherwise re-parsing fails with "expected string, received array".
  .preprocess((x) => (Array.isArray(x) ? x.join("\n") : x), z.string())
  .pipe(z.string().max(900, "Too long"))
  .transform((v) =>
    v
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
  )
  .pipe(
    z
      .array(z.string().max(100, "Keep each point under 100 characters"))
      .max(MAX_HIGHLIGHTS, `Up to ${MAX_HIGHLIGHTS} points`)
  )

const specSchema = z.object({
  label: z.string().trim().min(1, "Name this detail").max(40, "Too long"),
  value: z.string().trim().min(1, "Enter the value").max(120, "Too long"),
})

/** An extra charge added per item ordered (handling, packaging…). */
const feeSchema = z.object({
  label: z.string().trim().min(2, "Name this charge").max(40, "Keep it under 40 characters"),
  /** Short explanation the customer sees next to the charge. */
  reason: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(120, "Keep it under 120 characters").nullable()
  ),
  amount: requiredNumber("Enter an amount").pipe(z.number().gt(0, "Must be more than 0").max(LIMITS.feeAmount.max)),
})

export const productSchema = z
  .object({
    name: z.string().trim().min(LIMITS.productName.min, "Name is too short").max(LIMITS.productName.max, `Keep it under ${LIMITS.productName.max} characters`),
    slug,
    description: z.string().trim().max(LIMITS.productDescription.max, `Keep it under ${LIMITS.productDescription.max} characters`).default(""),
    price: v.money(LIMITS.money.max, "Price is required"),
    compareAtPrice: optionalNumber.pipe(z.number().min(0).max(1_000_000).nullable()),
    images: z.array(imageUrl).max(8, "Up to 8 images"),
    categoryId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    stock: v.wholeNumber(LIMITS.stock.max, "Stock is required"),
    fees: z.array(feeSchema).max(MAX_FEES_PER_PRODUCT, `Up to ${MAX_FEES_PER_PRODUCT} extra charges`).default([]),
    shortDescription: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(240, "Keep it under 240 characters").nullable()
    ),
    highlights: highlightLines,
    specs: z.array(specSchema).max(MAX_SPECS, `Up to ${MAX_SPECS} details`).default([]),
    careInstructions: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(1500, "Keep it under 1500 characters").nullable()
    ),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().max(70, "Keep under 70 characters").nullable().optional(),
    seoDescription: z.string().trim().max(160, "Keep under 160 characters").nullable().optional(),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "MRP must be higher than the selling price",
    path: ["compareAtPrice"],
  })
  .refine((p) => new Set(p.fees.map((f) => f.label.toLowerCase())).size === p.fees.length, {
    message: "Each extra charge needs a different name",
    path: ["fees"],
  })

export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(LIMITS.categoryName.min, "Name is too short").max(LIMITS.categoryName.max, `Keep it under ${LIMITS.categoryName.max} characters`),
  slug,
  description: z.string().trim().max(LIMITS.categoryDescription.max).default(""),
  sort: v.wholeNumber(LIMITS.sortOrder.max, "Required"),
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>

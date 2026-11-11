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

export const productSchema = z
  .object({
    name: z.string().trim().min(LIMITS.productName.min, "Name is too short").max(LIMITS.productName.max, `Keep it under ${LIMITS.productName.max} characters`),
    slug,
    description: z.string().trim().max(LIMITS.productDescription.max, `Keep it under ${LIMITS.productDescription.max} characters`).default(""),
    price: v.money(LIMITS.money.max, "Price is required"),
    compareAtPrice: v.optionalMoney(LIMITS.money.max),
    images: z.array(imageUrl).max(8, "Up to 8 images"),
    categoryId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    stock: v.wholeNumber(LIMITS.stock.max, "Stock is required"),
    weightGrams: z.preprocess(
      (x) => (x === "" || x === null || x === undefined ? 0 : x),
      v.wholeNumber(LIMITS.weightGrams.max, "Enter weight in grams (0 = standard)")
    ),
    shippingClass: z.enum(SHIPPING_CLASSES).default("standard"),
    shortDescription: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(LIMITS.shortDescription.max, `Keep it under ${LIMITS.shortDescription.max} characters`).nullable()
    ),
    highlights: highlightLines,
    specs: z.array(specSchema).max(MAX_SPECS, `Up to ${MAX_SPECS} details`).default([]),
    careInstructions: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? null : v),
      z.string().trim().max(LIMITS.careInstructions.max, `Keep it under ${LIMITS.careInstructions.max} characters`).nullable()
    ),
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
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>

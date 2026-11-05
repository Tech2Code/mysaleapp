import { z } from "zod"
import { supabaseConfig } from "@/lib/supabase/config"

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only")

/** Product images must live in our own Supabase Storage bucket. */
const imageUrl = z
  .url()
  .refine(
    (u) => u.startsWith(`${supabaseConfig.url}/storage/v1/object/public/product-images/`),
    "Image must be uploaded through the admin panel"
  )

/** Form inputs give "" (or NaN) for empty number fields; numeric strings are converted. */
const toNumberOrUndefined = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return undefined
  const n = typeof v === "string" ? Number(v) : v
  return typeof n === "number" && Number.isNaN(n) ? undefined : n
}

const requiredNumber = (message: string) =>
  z.preprocess(toNumberOrUndefined, z.number({ error: message }))

const optionalNumber = z.preprocess(
  (v) => toNumberOrUndefined(v) ?? null,
  z.number().nullable()
)

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(120),
    slug,
    description: z.string().trim().max(5000).default(""),
    price: requiredNumber("Price is required").pipe(z.number().min(0).max(1_000_000)),
    compareAtPrice: optionalNumber.pipe(z.number().min(0).max(1_000_000).nullable()),
    images: z.array(imageUrl).max(8, "Up to 8 images"),
    categoryId: z.preprocess((v) => (v === "" || v === undefined ? null : v), z.uuid().nullable()),
    stock: requiredNumber("Stock is required").pipe(z.number().int("Whole numbers only").min(0).max(100_000)),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    seoTitle: z.string().trim().max(70, "Keep under 70 characters").nullable().optional(),
    seoDescription: z.string().trim().max(160, "Keep under 160 characters").nullable().optional(),
  })
  .refine((p) => p.compareAtPrice == null || p.compareAtPrice > p.price, {
    message: "MRP must be higher than the selling price",
    path: ["compareAtPrice"],
  })

export type ProductInput = z.input<typeof productSchema>
export type ProductValues = z.output<typeof productSchema>

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(60),
  slug,
  description: z.string().trim().max(300).default(""),
  sort: requiredNumber("Required").pipe(z.number().int().min(0).max(999)),
})

export type CategoryInput = z.input<typeof categorySchema>
export type CategoryValues = z.output<typeof categorySchema>

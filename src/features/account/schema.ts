import { z } from "zod"
import { normalizeIndianPhone } from "@/lib/format"

const optional = (schema: z.ZodString) => schema.or(z.literal("")).optional()

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(80),
  phone: optional(
    z.string().trim().refine((v) => normalizeIndianPhone(v) !== null, "Enter a valid 10-digit mobile number")
  ),
  address: optional(z.string().trim().max(300)),
  city: optional(z.string().trim().max(60)),
  pincode: optional(z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode")),
})

export type ProfileInput = z.infer<typeof profileSchema>

export type Profile = {
  fullName: string
  phone: string
  address: string
  city: string
  pincode: string
  avatarUrl: string | null
  email: string
}

// Customer account: validation for the shopper's own profile. Admin login/password schemas live in features/auth/account-schema.ts.
import { z } from "zod"
import { v } from "@/lib/validation"

/** Name and phone only. Delivery addresses live in the address book (features/addresses). */
export const profileSchema = z.object({
  fullName: v.personName("name"),
  phone: z.union([z.literal(""), v.phoneIN()]).optional(),
})

export type ProfileInput = z.infer<typeof profileSchema>

export type Profile = {
  fullName: string
  phone: string
  avatarUrl: string | null
  email: string
}

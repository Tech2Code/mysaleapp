// Customer account: validation for the shopper's own profile. Admin login/password schemas live in features/auth/account-schema.ts.
import { z } from "zod"
import { normalizeIndianPhone } from "@/lib/format"
import { v } from "@/lib/validation"

/** Name, email and phone. Delivery addresses live in the address book (features/addresses). */
export const profileSchema = z.object({
  fullName: v.personName("name"),
  email: v.email().optional(),
  phone: z
    .string()
    .trim()
    .refine((x) => x === "" || normalizeIndianPhone(x) !== null, "Enter a valid 10-digit mobile number")
    .transform((x) => (x === "" ? "" : normalizeIndianPhone(x)!))
    .optional(),
})

export type ProfileInput = z.infer<typeof profileSchema>

export type Profile = {
  fullName: string
  phone: string
  avatarUrl: string | null
  email: string
  hasPassword?: boolean
  reactivated?: boolean
}

export const DEACTIVATION_REASONS = [
  "I don't shop here often",
  "I have another account",
  "Privacy or security concerns",
  "Taking a break from shopping",
  "Other",
] as const

export const deactivateAccountSchema = z.object({
  reason: z.string().trim().min(3, "Please select a reason for deactivating your account").max(200),
})

export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>

export const customerPasswordSchema = z
  .object({
    hasPassword: z.boolean(),
    current: z.string().optional(),
    next: v.newPassword(),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
  .superRefine((d, ctx) => {
    if (d.hasPassword) {
      if (!d.current || d.current.length < 6) {
        ctx.addIssue({ code: "custom", message: "Enter your current password", path: ["current"] })
      } else if (d.current === d.next) {
        ctx.addIssue({ code: "custom", message: "Use a new password, not your current one", path: ["next"] })
      }
    }
  })

export type CustomerPasswordInput = z.infer<typeof customerPasswordSchema>

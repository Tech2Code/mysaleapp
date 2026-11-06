// Admin account: login email / password schemas. The customer's profile schema lives in features/account/schema.ts.
import { z } from "zod"
import { v } from "@/lib/validation"

/** Shared by the admin account forms (browser) and the server actions, so both check the same rules. */

export const profileSchema = z.object({
  name: v.personName("name"),
  phone: v.optionalPhone(),
})

export const emailSchema = z.object({ email: v.email() })

export const changePasswordSchema = z
  .object({ current: v.password(), next: v.newPassword(), confirm: z.string() })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match", path: ["confirm"] })
  .refine((d) => d.next !== d.current, { message: "Use a new password, not the current one", path: ["next"] })

export const resetSchema = z
  .object({ next: v.newPassword(), confirm: z.string() })
  .refine((d) => d.next === d.confirm, { message: "Passwords don't match", path: ["confirm"] })

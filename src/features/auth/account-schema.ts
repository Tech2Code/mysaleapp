// Admin account: login email / password schemas. The customer's profile schema lives in features/account/schema.ts.
import { z } from "zod"
import { PATTERNS, v } from "@/lib/validation"

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

/** Full admin login lasts 7 days; optional 4-digit PIN re-locks every 12 hours instead of logging out. */
export const ADMIN_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const ADMIN_PIN_WINDOW_MS = 12 * 60 * 60 * 1000

export type AdminPinMode = "unset" | "enabled" | "disabled"

export type AdminPinStatus = {
  mode: AdminPinMode
  hasPin: boolean
  updatedAt: string | null
  lockedUntil: string | null
  unlockedAt: number
  manualLock: boolean
}

export const setPinSchema = z
  .object({
    pin: v.adminPin(),
    confirm: z.string().trim(),
  })
  .refine((d) => d.pin === d.confirm, { message: "PINs don't match", path: ["confirm"] })

export const changePinSchema = z
  .object({
    authMethod: z.enum(["pin", "password"]),
    currentPin: z.string().trim().optional(),
    password: z.string().optional(),
    next: v.adminPin(),
    confirm: z.string().trim(),
  })
  .refine((d) => d.next === d.confirm, { message: "PINs don't match", path: ["confirm"] })
  .superRefine((d, ctx) => {
    if (d.authMethod === "pin" && !PATTERNS.adminPin.test(d.currentPin ?? "")) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your current 4-digit PIN",
        path: ["currentPin"],
      })
    } else if (d.authMethod === "pin" && d.currentPin === d.next) {
      ctx.addIssue({
        code: "custom",
        message: "New PIN must be different from current PIN",
        path: ["next"],
      })
    } else if (d.authMethod === "password" && (d.password ?? "").length < 6) {
      ctx.addIssue({
        code: "custom",
        message: "Enter your account password",
        path: ["password"],
      })
    }
  })

export const verifyPinSchema = z.object({
  pin: v.adminPin(),
})

export const unlockPinWithPasswordSchema = z
  .object({
    password: v.password(),
    action: z.enum(["unlock", "reset", "disable"]),
    newPin: z.string().trim().optional(),
    confirmPin: z.string().trim().optional(),
  })
  .refine((d) => d.action !== "reset" || PATTERNS.adminPin.test(d.newPin ?? ""), {
    message: "Enter a new 4-digit PIN",
    path: ["newPin"],
  })
  .refine((d) => d.action !== "reset" || d.newPin === d.confirmPin, {
    message: "PINs don't match",
    path: ["confirmPin"],
  })

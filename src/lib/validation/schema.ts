import { z } from "zod"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS, PATTERNS } from "./limits"
import { requiredNumber } from "@/lib/zod-helpers"

/**
 * Reusable zod rules ("primitives"). Every schema in the app builds on these, so the same kind of data
 * is validated the same way, with the same limits and messages, on the form AND on the server.
 * Add a new rule here once and use it everywhere.
 */

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v)

export const v = {
  /** A person's name: letters, spaces and . ' - */
  personName: (label = "name") =>
    z
      .string()
      .trim()
      .min(LIMITS.personName.min, `Please enter a valid ${label}`)
      .max(LIMITS.personName.max, `Keep the ${label} under ${LIMITS.personName.max} characters`)
      .regex(PATTERNS.personName, "Use letters only"),

  city: () =>
    z
      .string()
      .trim()
      .min(LIMITS.city.min, "Please enter the city")
      .max(LIMITS.city.max, `Keep it under ${LIMITS.city.max} characters`)
      .regex(PATTERNS.personName, "Use letters only"),

  address: () =>
    z
      .string()
      .trim()
      .min(LIMITS.address.min, "Please enter the full address")
      .max(LIMITS.address.max, `Keep it under ${LIMITS.address.max} characters`),

  /** Indian mobile number; +91 / 0 prefixes are accepted. */
  phoneIN: () =>
    z
      .string()
      .trim()
      .refine((x) => normalizeIndianPhone(x) !== null, "Enter a valid 10-digit mobile number"),

  pincode: () => z.string().trim().regex(PATTERNS.pincode, "Enter a valid 6-digit pincode"),

  note: (max: number = LIMITS.note.max) => z.string().trim().max(max, `Keep it under ${max} characters`),

  email: () =>
    z
      .string()
      .trim()
      .max(LIMITS.email.max, `Keep it under ${LIMITS.email.max} characters`)
      .pipe(z.email("Enter a valid email address")),

  password: () =>
    z
      .string()
      .min(LIMITS.password.min, `Password must be at least ${LIMITS.password.min} characters`)
      .max(LIMITS.password.max, "Password is too long"),

  /** A NEW password (setting or changing): stronger than the login check, which must accept older ones. */
  newPassword: () =>
    z
      .string()
      .min(LIMITS.newPassword.min, `Use at least ${LIMITS.newPassword.min} characters`)
      .max(LIMITS.password.max, "Password is too long")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/d/, "Include at least one number"),

  /** http(s) link only (blocks javascript: and other schemes). */
  url: (what = "link") =>
    z
      .string()
      .trim()
      .max(LIMITS.url.max, `Keep it under ${LIMITS.url.max} characters`)
      .refine((u) => {
        try {
          const { protocol } = new URL(u)
          return protocol === "http:" || protocol === "https:"
        } catch {
          return false
        }
      }, `Enter the full ${what}, starting with https://`),

  slug: () =>
    z
      .string()
      .trim()
      .min(LIMITS.slug.min, "Too short")
      .max(LIMITS.slug.max, `Keep it under ${LIMITS.slug.max} characters`)
      .regex(PATTERNS.slug, "Use lowercase letters, numbers and hyphens only"),

  /** Rupee amount typed into a form field ("12", "12.5"), required. */
  money: (max: number = LIMITS.money.max, message = "Enter an amount") =>
    requiredNumber(message).pipe(z.number().min(0, "Can't be negative").max(max, "That's too large")),

  /** Whole number typed into a form field (stock, sort order…). */
  wholeNumber: (max: number, message = "Enter a number") =>
    requiredNumber(message).pipe(z.number().int("Whole numbers only").min(0, "Can't be negative").max(max, "That's too large")),

  orderCode: () => z.string().trim().toUpperCase().regex(PATTERNS.orderCode, "Enter the order code, e.g. KK-7F3K9Q"),

  orderLast4: () => z.string().trim().regex(/^\d{4}$/, "Enter the last 4 digits of your phone"),

  /** UPI reference / UTR, 8 to 35 letters or digits. */
  utr: () =>
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(PATTERNS.utr, "Enter the UTR from your payment app (12 digits)"),

  upiId: () => z.string().trim().max(LIMITS.upiId.max).regex(PATTERNS.upiId, "Enter a valid UPI ID, like name@bank"),

  /** Optional text: empty → null. */
  optionalText: (max: number) =>
    z.preprocess(blankToNull, z.string().trim().max(max, `Keep it under ${max} characters`).nullable()),

  optionalPhone: () => z.preprocess(blankToNull, v.phoneIN().nullable()),

  optionalEmail: () => z.preprocess(blankToNull, v.email().nullable()),

  optionalUrl: (what?: string) => z.preprocess(blankToNull, v.url(what).nullable()),
}

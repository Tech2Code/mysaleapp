import { LIMITS } from "./limits"

/**
 * What each KIND of form field accepts. Pass `kind="phone"` to <TextField> and it will
 * (a) block characters that can't be valid, (b) cap the length, (c) show the right mobile keyboard.
 * The matching zod rules are in ./schema.ts and use the same LIMITS.
 */
export type FieldKind =
  | "personName"
  | "city"
  | "phone"
  | "intlPhone"
  | "displayPhone"
  | "pincode"
  | "digits"
  | "money"
  | "email"
  | "url"
  | "orderCode"
  | "orderLast4"
  | "paymentRef"
  | "trackingNumber"
  | "upiId"
  | "slug"
  | "orderPrefix"

type InputAttrs = {
  type?: "text" | "tel" | "email" | "url" | "password"
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url"
  autoComplete?: string
  autoCapitalize?: "none" | "characters" | "words"
  maxLength?: number
  spellCheck?: boolean
}

type FieldKindSpec = InputAttrs & {
  /** Removes characters that can never be valid. Runs on every keystroke and paste. */
  sanitize?: (value: string) => string
}

const digitsOnly = (v: string) => v.replace(/\D/g, "")

/** Keep digits and a single dot, with at most two decimals ("12.345" → "12.34"). */
function money(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "")
  const [whole = "", ...rest] = cleaned.split(".")
  if (rest.length === 0) return whole
  return `${whole}.${rest.join("").slice(0, 2)}`
}

/** "+91 98765-43210" / "098765 43210" → "9876543210". */
function indianPhone(v: string): string {
  let d = digitsOnly(v)
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2)
  if (d.length > 10 && d.startsWith("0")) d = d.slice(1)
  return d.slice(0, LIMITS.phone)
}

export const FIELD_KINDS: Record<FieldKind, FieldKindSpec> = {
  personName: {
    sanitize: (v) => v.replace(/[^\p{L}\p{M}\s.'-]/gu, "").replace(/\s{2,}/g, " "),
    maxLength: LIMITS.personName.max,
    autoComplete: "name",
    autoCapitalize: "words",
  },
  city: {
    sanitize: (v) => v.replace(/[^\p{L}\p{M}\s.'-]/gu, "").replace(/\s{2,}/g, " "),
    maxLength: LIMITS.city.max,
    autoComplete: "address-level2",
    autoCapitalize: "words",
  },
  phone: { sanitize: indianPhone, type: "tel", inputMode: "numeric", maxLength: LIMITS.phone + 6, autoComplete: "tel-national" },
  intlPhone: { sanitize: (v) => digitsOnly(v).slice(0, LIMITS.intlPhone.max), type: "tel", inputMode: "numeric", maxLength: LIMITS.intlPhone.max },
  displayPhone: {
    sanitize: (v) => v.replace(/[^\d+\-\s()]/g, ""),
    type: "tel",
    inputMode: "tel",
    maxLength: LIMITS.displayPhone.max,
  },
  pincode: { sanitize: (v) => digitsOnly(v).slice(0, LIMITS.pincode), inputMode: "numeric", maxLength: LIMITS.pincode, autoComplete: "postal-code" },
  digits: { sanitize: digitsOnly, inputMode: "numeric" },
  money: { sanitize: money, inputMode: "decimal", maxLength: 10 },
  email: { type: "email", inputMode: "email", maxLength: LIMITS.email.max, autoComplete: "email", autoCapitalize: "none", spellCheck: false },
  url: { type: "url", inputMode: "url", maxLength: LIMITS.url.max, autoCapitalize: "none", spellCheck: false },
  orderCode: {
    sanitize: (v) => v.toUpperCase().replace(/[^A-Z0-9-]/g, ""),
    maxLength: LIMITS.orderCode.max,
    autoCapitalize: "characters",
    spellCheck: false,
  },
  orderLast4: { sanitize: (v) => digitsOnly(v).slice(0, LIMITS.orderLast4), inputMode: "numeric", maxLength: LIMITS.orderLast4 },
  paymentRef: {
    sanitize: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    maxLength: LIMITS.utr.max,
    autoCapitalize: "characters",
    spellCheck: false,
  },
  trackingNumber: {
    sanitize: (v) => v.replace(/[^A-Za-z0-9\-/]/g, ""),
    maxLength: LIMITS.trackingNumber.max,
    autoCapitalize: "characters",
    spellCheck: false,
  },
  upiId: { sanitize: (v) => v.replace(/[^A-Za-z0-9._@-]/g, ""), maxLength: LIMITS.upiId.max, autoCapitalize: "none", spellCheck: false },
  slug: {
    sanitize: (v) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-"),
    maxLength: LIMITS.slug.max,
    autoCapitalize: "none",
    spellCheck: false,
  },
  orderPrefix: {
    sanitize: (v) => v.toUpperCase().replace(/[^A-Z]/g, "").slice(0, LIMITS.orderPrefix.max),
    maxLength: LIMITS.orderPrefix.max,
    autoCapitalize: "characters",
    spellCheck: false,
  },
}

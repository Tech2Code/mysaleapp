const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

export function formatPrice(value: number): string {
  return inr.format(value)
}

const inrExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Rupees with paise, for invoices where tax is split out (formatPrice rounds to whole rupees). */
export function formatMoney(value: number): string {
  return inrExact.format(value)
}

export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null
  return Math.round(((compareAt - price) / compareAt) * 100)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

const IST = "Asia/Kolkata"

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: IST,
})

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: IST,
})

/** Parse a date-like input safely into a Date in Asia/Kolkata context. */
function parseDateInput(input: string | Date | number): Date {
  if (typeof input === "object" && input instanceof Date) return input
  if (typeof input === "string") {
    const trimmed = input.trim()
    // "2026-11-06" -> treat as IST midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00+05:30`)
    }
    // "2026-11-06T00:00:00" without timezone offset -> treat as IST
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}+05:30`)
    }
  }
  return new Date(input)
}

export function formatDate(iso: string | Date | number | null | undefined): string {
  if (!iso) return ""
  const d = parseDateInput(iso)
  return Number.isNaN(d.getTime()) ? "" : dateFmt.format(d)
}

export function formatDateTime(iso: string | Date | number | null | undefined): string {
  if (!iso) return ""
  const d = parseDateInput(iso)
  return Number.isNaN(d.getTime()) ? "" : dateTimeFmt.format(d)
}

/** "919876543210" → "+91 98765 43210" (other lengths: "+" and the digits). */
export function formatPhoneDisplay(digitsWithCountryCode: string): string {
  const d = digitsWithCountryCode.replace(/\D/g, "")
  return /^91\d{10}$/.test(d) ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : `+${d}`
}

/** Normalise an Indian mobile number to 10 digits, or return null if invalid. */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "")
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

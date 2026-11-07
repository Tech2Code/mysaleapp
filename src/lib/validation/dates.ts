import { PATTERNS } from "./limits"

/** Today's calendar day in India as YYYY-MM-DD (what the shop's staff mean by "today"). */
export function todayIST(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
}

/** `YYYY-MM-DD` shifted by whole days (calendar arithmetic, no time zone drift). */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A real calendar day in `YYYY-MM-DD` form (rejects 2026-02-31 and 2026-13-01). */
export function isRealIsoDate(s: string): boolean {
  if (!PATTERNS.isoDate.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s)
}

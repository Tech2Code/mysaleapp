/**
 * When an unpaid order is cancelled automatically (setting: Admin → Settings → Orders).
 * Shown wherever a customer might still pay, so the cancellation never comes as a surprise.
 */

/** null when auto-cancel is off (hours = 0). */
export function paymentDeadline(createdAt: string, hours: number): Date | null {
  if (!hours || hours <= 0) return null
  return new Date(new Date(createdAt).getTime() + hours * 3_600_000)
}

/** e.g. "6 Nov, 4:41 pm" (India time). */
export function formatDeadline(d: Date): string {
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
}

/** "24 hours", "1 hour", "3 days" */
export function describeHours(hours: number): string {
  if (hours % 24 === 0 && hours >= 48) return `${hours / 24} days`
  return `${hours} hour${hours === 1 ? "" : "s"}`
}

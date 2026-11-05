/**
 * Date ranges for the admin dashboard (`/admin?range=30d` or `?from=2026-01-01&to=2026-01-31`).
 * Pure functions, used by both the server query and the range picker. All dates are India time.
 */

export const RANGE_PRESETS = [
  { key: "year", label: "This year" },
  { key: "last-year", label: "Last year" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "90d", label: "Last 90 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "7d", label: "Last 7 days" },
  { key: "all", label: "All time" },
] as const

export type RangeKey = (typeof RANGE_PRESETS)[number]["key"] | "custom"

export type DashboardRange = {
  key: RangeKey
  /** Short text for headings, e.g. "Last 30 days", "March 2026". */
  label: string
  /** Inclusive start, exclusive end. */
  start: Date
  end: Date
  /** The equally long period just before; null for "All time". */
  previous: { start: Date; end: Date } | null
  /** Chart granularity: days for up to ~3 months, otherwise months. */
  bucket: "day" | "month"
  from: string
  to: string
}

const DAY = 24 * 60 * 60 * 1000
const IST_OFFSET = "+05:30"
const YMD = /^\d{4}-\d{2}-\d{2}$/

export const istDayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00${IST_OFFSET}`)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })

function monthStart(ymd: string, offsetMonths = 0): Date {
  const [y, m] = ymd.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1))
  return startOfDay(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`)
}

/** `now` is passed in (not read here) so callers read the clock only after a dynamic API like connection(). */
export function resolveRange(input: { range?: string; from?: string; to?: string }, now: Date): DashboardRange {
  const today = istDayKey(now)
  const tomorrow = addDays(startOfDay(today), 1)
  const make = (key: RangeKey, label: string, start: Date, end: Date, previous = true): DashboardRange => {
    const span = end.getTime() - start.getTime()
    return {
      key,
      label,
      start,
      end,
      previous: previous ? { start: new Date(start.getTime() - span), end: start } : null,
      bucket: span > 92 * DAY ? "month" : "day",
      from: istDayKey(start),
      to: istDayKey(new Date(end.getTime() - 1)),
    }
  }

  if (input.from && input.to && YMD.test(input.from) && YMD.test(input.to)) {
    const [a, b] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from]
    const end = addDays(startOfDay(b), 1)
    const start = startOfDay(a)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return make("custom", a === b ? fmt(start) : `${fmt(start)} – ${fmt(addDays(end, -1))}`, start, end)
    }
  }

  switch (input.range) {
    case "7d":
      return make("7d", "Last 7 days", addDays(tomorrow, -7), tomorrow)
    case "90d":
      return make("90d", "Last 90 days", addDays(tomorrow, -90), tomorrow)
    case "month": {
      const start = monthStart(today)
      return make("month", "This month", start, tomorrow)
    }
    case "last-month": {
      const start = monthStart(today, -1)
      const end = monthStart(today)
      return make("last-month", start.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }), start, end)
    }
    case "year": {
      const start = startOfDay(`${today.slice(0, 4)}-01-01`)
      return make("year", "This year", start, tomorrow)
    }
    case "last-year": {
      const y = Number(today.slice(0, 4))
      return make("last-year", String(y - 1), startOfDay(`${y - 1}-01-01`), startOfDay(`${y}-01-01`))
    }
    case "all":
      // the real first order date is filled in by the query; this is just a floor
      return make("all", "All time", startOfDay("2020-01-01"), tomorrow, false)
    default:
      return make("30d", "Last 30 days", addDays(tomorrow, -30), tomorrow)
  }
}

/**
 * Date ranges for the admin dashboard. All dates are India time, and the default is the current
 * financial year (1 April to 31 March):
 *   /admin                       this financial year so far (default)
 *   /admin?range=month           this month so far
 *   /admin?month=2026-03         one particular month
 *   /admin?from=…&to=…           custom dates
 * Pure functions, used by both the server query and the range picker.
 */

export const RANGE_OPTIONS = [
  { key: "fy", label: "This financial year" },
  { key: "month", label: "This month" },
  { key: "pick-month", label: "Choose a month…" },
  { key: "custom", label: "Custom dates…" },
] as const

export type RangeKey = (typeof RANGE_OPTIONS)[number]["key"]

export type DashboardRange = {
  key: RangeKey
  /** Short text for headings, e.g. "FY 2026-27", "March 2026". */
  label: string
  /** Inclusive start, exclusive end. */
  start: Date
  end: Date
  /** The period to compare with (same stretch of the previous year / month). */
  previous: { start: Date; end: Date } | null
  /** Chart granularity: days for up to ~3 months, otherwise months. */
  bucket: "day" | "month"
  from: string
  to: string
}

const DAY = 24 * 60 * 60 * 1000
const IST_OFFSET = "+05:30"
const YMD = /^\d{4}-\d{2}-\d{2}$/
const YM = /^\d{4}-(0[1-9]|1[0-2])$/

export const istDayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00${IST_OFFSET}`)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
const monthName = (d: Date) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

/** First day of the month that is `offsetMonths` away from the month of `ymd`. */
function monthStart(ymd: string, offsetMonths = 0): Date {
  const [y, m] = ymd.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + offsetMonths, 1))
  return startOfDay(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`)
}

const earlier = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b)

/** `now` is passed in (not read here) so callers read the clock only after a dynamic API like connection(). */
export function resolveRange(input: { range?: string; month?: string; from?: string; to?: string }, now: Date): DashboardRange {
  const today = istDayKey(now)
  const tomorrow = addDays(startOfDay(today), 1)

  const make = (key: RangeKey, label: string, start: Date, end: Date, previous: DashboardRange["previous"]): DashboardRange => ({
    key,
    label,
    start,
    end,
    previous,
    bucket: end.getTime() - start.getTime() > 92 * DAY ? "month" : "day",
    from: istDayKey(start),
    to: istDayKey(new Date(end.getTime() - 1)),
  })

  if (input.from && input.to && YMD.test(input.from) && YMD.test(input.to)) {
    const [a, b] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from]
    const start = startOfDay(a)
    const end = addDays(startOfDay(b), 1)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const span = end.getTime() - start.getTime()
      return make("custom", a === b ? fmt(start) : `${fmt(start)} – ${fmt(addDays(end, -1))}`, start, end, {
        start: new Date(start.getTime() - span),
        end: start,
      })
    }
  }

  if (input.month && YM.test(input.month)) {
    const start = startOfDay(`${input.month}-01`)
    const nextMonth = monthStart(`${input.month}-01`, 1)
    const end = earlier(nextMonth, tomorrow) // the running month only counts up to today
    if (end.getTime() > start.getTime()) {
      const prevStart = monthStart(`${input.month}-01`, -1)
      return make("pick-month", monthName(start), start, end, {
        start: prevStart,
        end: earlier(new Date(prevStart.getTime() + (end.getTime() - start.getTime())), start),
      })
    }
  }

  if (input.range === "month") {
    const start = monthStart(today)
    const prevStart = monthStart(today, -1)
    return make("month", "This month", start, tomorrow, {
      start: prevStart,
      end: earlier(new Date(prevStart.getTime() + (tomorrow.getTime() - start.getTime())), start),
    })
  }

  // default: this financial year (April → March), compared with the same stretch of last year
  const year = Number(today.slice(0, 4))
  const fyStartYear = Number(today.slice(5, 7)) >= 4 ? year : year - 1
  const start = startOfDay(`${fyStartYear}-04-01`)
  const prevStart = startOfDay(`${fyStartYear - 1}-04-01`)
  return make("fy", `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`, start, tomorrow, {
    start: prevStart,
    end: earlier(new Date(prevStart.getTime() + (tomorrow.getTime() - start.getTime())), start),
  })
}

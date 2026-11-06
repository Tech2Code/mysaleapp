/**
 * Date ranges for the admin dashboard. All dates are India time, and the default is the current
 * financial year (1 April to 31 March):
 *   /admin                       this financial year so far (default)
 *   /admin?fy=2025               a whole past financial year (FY 2025-26)
 *   /admin?range=month           this month so far
 *   /admin?month=2026-03         one particular month
 *   /admin?from=…&to=…           custom dates
 * Pure functions, used by both the server query and the range picker.
 */

export type RangeKey = "fy" | "past-fy" | "month" | "pick-month" | "custom"

export type RangeOption = { value: string; label: string }

const fyLabel = (startYear: number) => `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
const fyStartYearOf = (ymd: string) => (Number(ymd.slice(5, 7)) >= 4 ? Number(ymd.slice(0, 4)) : Number(ymd.slice(0, 4)) - 1)
const monthLabelUtc = (ym: string) => new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })

/** Financial years in the first dropdown: the current one and the 4 before it (value = start year). */
export function fyOptions(today: string, current?: { from: string }): RangeOption[] {
  const fy = fyStartYearOf(today)
  const years = [fy, fy - 1, fy - 2, fy - 3, fy - 4]
  if (current) {
    const y = fyStartYearOf(current.from)
    if (!years.includes(y)) years.push(y)
  }
  return years.map((y) => ({ value: String(y), label: `${fyLabel(y)}${y === fy ? " (current)" : ""}` }))
}

/** Months of one financial year (April → March, up to today), plus "Whole year" and "Custom dates…". */
export function monthOptions(today: string, fyYear: number): RangeOption[] {
  const options: RangeOption[] = [{ value: "all", label: "Whole year" }]
  const thisMonth = today.slice(0, 7)
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(fyYear, 3 + i, 1))
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
    if (ym > thisMonth) break
    options.push({ value: ym, label: monthLabelUtc(ym) })
  }
  options.push({ value: "custom", label: "Custom dates…" })
  return options
}

/** Financial year (start year) a resolved range belongs to. */
export const fyYearOf = (from: string) => fyStartYearOf(from)

/** Value of the month dropdown for a resolved range. */
export function monthValue(key: RangeKey, from: string): string {
  if (key === "custom") return "custom"
  if (key === "pick-month" || key === "month") return from.slice(0, 7)
  return "all"
}

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
/** A real calendar date: "2026-02-31" matches the pattern but Date would silently roll it into March. */
const isRealDate = (ymd: string) => {
  if (!YMD.test(ymd)) return false
  const d = new Date(`${ymd}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd
}
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
export function resolveRange(input: { range?: string; month?: string; fy?: string; from?: string; to?: string }, now: Date): DashboardRange {
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

  if (input.from && input.to && isRealDate(input.from) && isRealDate(input.to)) {
    const [a, b] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from]
    const start = startOfDay(a)
    const end = addDays(startOfDay(b), 1)
    // A huge span (?from=1900-01-01&to=2100-12-31) would pull the whole orders table, so it is ignored.
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() - start.getTime() <= 1100 * DAY) {
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

  if (input.fy && /^\d{4}$/.test(input.fy) && Number(input.fy) < fyStartYearOf(today)) {
    const fyYear = Number(input.fy)
    const start = startOfDay(`${fyYear}-04-01`)
    const end = startOfDay(`${fyYear + 1}-04-01`)
    return make("past-fy", fyLabel(fyYear), start, end, { start: startOfDay(`${fyYear - 1}-04-01`), end: start })
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
  const fyStartYear = fyStartYearOf(today)
  const start = startOfDay(`${fyStartYear}-04-01`)
  const prevStart = startOfDay(`${fyStartYear - 1}-04-01`)
  return make("fy", fyLabel(fyStartYear), start, tomorrow, {
    start: prevStart,
    end: earlier(new Date(prevStart.getTime() + (tomorrow.getTime() - start.getTime())), start),
  })
}

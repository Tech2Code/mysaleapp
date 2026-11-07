"use client"

import { CalendarRangeIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { DashboardBody } from "@/components/admin/dashboard/dashboard-body"
import { SelectField, TextField } from "@/components/form"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderDashboard } from "@/features/orders/placeholders"
import { fyOptions, fyYearOf, monthOptions, monthValue, type RangeKey } from "@/features/orders/dashboard-range"

type Selected = { key: RangeKey; from: string; to: string }

/**
 * The dashboard always lives here. Not read with usePathname(): this component is also rendered inside
 * the admin loading.tsx fallback, and a runtime-only hook there breaks prerendering of every admin page.
 */
const DASHBOARD_PATH = "/admin"

/**
 * Date-range picker + the dashboard numbers it controls (`children`, rendered on the server).
 * Default = this financial year. A skeleton shows while new numbers load; you can pick again at any time.
 */
export function DashboardRangeShell({
  current,
  today,
  children,
}: {
  current: Selected
  /** Today's date (YYYY-MM-DD, India), from the server. */
  today: string
  children: ReactNode
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // two dropdowns: financial year, then a month of that year (or the whole year, or custom dates)
  const [fyYear, setFyYear] = useState(String(fyYearOf(current.from)))
  const [monthSel, setMonthSel] = useState(monthValue(current.key, current.from))
  const [from, setFrom] = useState(current.key === "custom" ? current.from : "")
  const [to, setTo] = useState(current.key === "custom" ? current.to : "")
  const fys = fyOptions(today, current)
  const months = monthOptions(today, Number(fyYear))
  const currentFy = String(fyYearOf(today))

  const go = (qs: string) =>
    startTransition(() => {
      router.push(`${DASHBOARD_PATH}${qs}`)
    })

  const applyCustom = (f: string, t: string) => {
    if (f && t) go(`?from=${f}&to=${t}`)
  }

  const onPickYear = (y: string) => {
    setFyYear(y)
    setMonthSel("all")
    go(y === currentFy ? "" : `?fy=${y}`)
  }

  const onPickMonth = (m: string) => {
    setMonthSel(m)
    if (m === "all") go(fyYear === currentFy ? "" : `?fy=${fyYear}`)
    else if (m === "custom") applyCustom(from, to)
    else go(`?month=${m}`)
  }

  const showing =
    monthSel === "custom"
      ? from && to
        ? `${from} to ${to}`
        : "pick the dates"
      : `${fys.find((o) => o.value === fyYear)?.label.replace(" (current)", "") ?? ""}${monthSel === "all" ? "" : ` · ${months.find((o) => o.value === monthSel)?.label ?? monthSel}`}`

  return (
    <div data-ui="admin/DashboardRangeShell" className="space-y-6">
      <div data-ui="admin/DashboardRangeShell/div-flex" className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <SelectField
          label="Financial year"
          hideLabel
          fieldSize="md"
          noErrorSpace
          containerClassName="w-full sm:w-52"
          value={fyYear}
          onValueChange={onPickYear}
          options={fys}
        />
        <SelectField
          label="Month"
          hideLabel
          fieldSize="md"
          noErrorSpace
          containerClassName="w-full sm:w-52"
          value={monthSel}
          onValueChange={onPickMonth}
          options={months}
        />
        {monthSel === "custom" && (
          <div data-ui="admin/DashboardRangeShell/div-custom-date-range" className="flex w-full flex-wrap items-end gap-2 sm:w-auto" role="group" aria-label="Custom date range">
            <CalendarRangeIcon className="mb-2.5 size-4 text-primary" aria-hidden />
            <TextField
              label="From"
              hideLabel
              type="date"
              fieldSize="md"
              max={to || today}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                applyCustom(e.target.value, to)
              }}
              containerClassName="min-w-36 flex-1 sm:w-40 sm:flex-none"
              noErrorSpace
            />
            <span data-ui="admin/DashboardRangeShell/span" className="mb-2.5 text-sm text-muted-foreground">
              to
            </span>
            <TextField
              label="To"
              hideLabel
              type="date"
              fieldSize="md"
              min={from || undefined}
              max={today}
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                applyCustom(from, e.target.value)
              }}
              containerClassName="min-w-36 flex-1 sm:w-40 sm:flex-none"
              noErrorSpace
            />
          </div>
        )}
        <p data-ui="admin/DashboardRangeShell/p" className="mb-2.5 text-sm text-muted-foreground" aria-live="polite">
          Showing: <span data-ui="admin/DashboardRangeShell/span-2" className="font-medium text-foreground">{showing}</span>
        </p>
      </div>
      <div data-ui="admin/DashboardRangeShell/div" aria-busy={pending}>
        {pending ? <Skeletonize><DashboardBody d={placeholderDashboard()} bucket="day" /></Skeletonize> : children}
      </div>
    </div>
  )
}

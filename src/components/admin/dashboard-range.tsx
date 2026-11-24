"use client"

import { CalendarRangeIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { DashboardBody } from "@/components/admin/dashboard/dashboard-body"
import { DateField, SelectField } from "@/components/form"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderDashboard } from "@/features/orders/placeholders"
import { fyOptions, fyYearOf, monthOptions, monthValue, type RangeKey } from "@/features/orders/dashboard-range"
import { cn } from "@/lib/utils"
import styles from "./admin-core.module.css"

type Selected = { key: RangeKey; from: string; to: string }

/**
 * The dashboard always lives here. Not read with usePathname(): this component is also rendered inside
 * the admin loading.tsx fallback, and a runtime-only hook there breaks prerendering of every admin page.
 */
const DASHBOARD_PATH = "/admin"

/**
 * Date-range picker + the dashboard numbers it controls (`children`, rendered on the server).
 * Default = current month. A skeleton shows while new numbers load; you can pick again at any time.
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
  const currentSignature = `${current.key}:${current.from}:${current.to}`
  const [prevSignature, setPrevSignature] = useState(currentSignature)
  if (currentSignature !== prevSignature) {
    setPrevSignature(currentSignature)
    setFyYear(String(fyYearOf(current.from)))
    setMonthSel(monthValue(current.key, current.from))
    setFrom(current.key === "custom" ? current.from : "")
    setTo(current.key === "custom" ? current.to : "")
  }
  const fys = fyOptions(today, current)
  const months = monthOptions(today, Number(fyYear))
  const currentFy = String(fyYearOf(today))
  const currentMonth = today.slice(0, 7)

  const go = (qs: string) =>
    startTransition(() => {
      router.push(`${DASHBOARD_PATH}${qs}`)
    })

  const applyCustom = (f: string, t: string) => {
    if (f && t && f <= t) go(`?from=${f}&to=${t}`)
  }

  const onPickYear = (y: string) => {
    setFyYear(y)
    setFrom("")
    setTo("")
    if (y === currentFy) {
      setMonthSel(currentMonth)
      go("")
    } else {
      setMonthSel("all")
      go(`?fy=${y}`)
    }
  }

  const onPickMonth = (m: string) => {
    setMonthSel(m)
    if (m !== "custom") {
      setFrom("")
      setTo("")
    }
    if (m === "all") go(fyYear === currentFy ? "?range=fy" : `?fy=${fyYear}`)
    else if (m === "custom") applyCustom(from, to)
    else if (m === currentMonth && fyYear === currentFy) go("")
    else go(`?month=${m}`)
  }

  const showing =
    monthSel === "custom"
      ? from && to
        ? `${from} to ${to}`
        : "pick the dates"
      : `${fys.find((o) => o.value === fyYear)?.label.replace(" (current)", "") ?? ""}${monthSel === "all" ? "" : ` · ${months.find((o) => o.value === monthSel)?.label ?? monthSel}`}`

  return (
    <div className={styles.rangeShell}>
      <div className={cn("adminCard", styles.rangeControlsCard)}>
        <SelectField
          label="Financial year"
          hideLabel
          fieldSize="md"
          noErrorSpace
          containerClassName={styles.selectContainer}
          value={fyYear}
          onValueChange={onPickYear}
          options={fys}
        />
        <SelectField
          label="Month"
          hideLabel
          fieldSize="md"
          noErrorSpace
          containerClassName={styles.selectContainer}
          value={monthSel}
          onValueChange={onPickMonth}
          options={months}
        />
        {monthSel === "custom" && (
          <div className={styles.customRangeGroup} role="group" aria-label="Custom date range">
            <CalendarRangeIcon className={styles.calendarIcon} aria-hidden />
            <DateField
              label="From"
              hideLabel
              placeholder="From date"
              fieldSize="md"
              max={to || today}
              value={from}
              onChange={(val) => {
                setFrom(val)
                applyCustom(val, to)
              }}
              containerClassName={styles.dateContainer}
              noErrorSpace
            />
            <span className={styles.rangeToWord}>
              to
            </span>
            <DateField
              label="To"
              hideLabel
              placeholder="To date"
              fieldSize="md"
              min={from || undefined}
              max={today}
              value={to}
              onChange={(val) => {
                setTo(val)
                applyCustom(from, val)
              }}
              containerClassName={styles.dateContainer}
              noErrorSpace
            />
          </div>
        )}
        <p className={styles.showingText} aria-live="polite">
          Showing: <span className={styles.showingStrong}>{showing}</span>
        </p>
      </div>
      <div aria-busy={pending}>
        {pending ? <Skeletonize><DashboardBody d={placeholderDashboard()} bucket="day" /></Skeletonize> : children}
      </div>
    </div>
  )
}

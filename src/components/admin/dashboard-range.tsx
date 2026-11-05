"use client"

import { CalendarRangeIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition, type ReactNode } from "react"
import { SelectField, TextField } from "@/components/form"
import { RANGE_OPTIONS, type RangeKey } from "@/features/orders/dashboard-range"

type Selected = { key: RangeKey; from: string; to: string }

function DashboardSkeleton() {
  return (
    <div data-ui="admin/DashboardSkeleton" className="space-y-6" aria-hidden>
      <div data-ui="admin/DashboardSkeleton/div-grid" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div data-ui="admin/DashboardSkeleton/div" key={i} className="h-36 animate-pulse rounded-2xl border bg-muted/60" />
        ))}
      </div>
      <div data-ui="admin/DashboardSkeleton/div-grid-2" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-ui="admin/DashboardSkeleton/div-2" className="h-96 animate-pulse rounded-2xl border bg-muted/60" />
        <div data-ui="admin/DashboardSkeleton/div-3" className="h-96 animate-pulse rounded-2xl border bg-muted/60" />
      </div>
    </div>
  )
}

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
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useOptimistic<Selected, Selected>(current, (_, next) => next)
  // what the dropdown shows: choosing "Choose a month…" / "Custom dates…" opens its inputs before anything reloads
  const [mode, setMode] = useState<RangeKey>(current.key)
  const [month, setMonth] = useState(current.key === "pick-month" ? current.from.slice(0, 7) : "")
  const [from, setFrom] = useState(current.key === "custom" ? current.from : "")
  const [to, setTo] = useState(current.key === "custom" ? current.to : "")

  const apply = (next: Selected, qs: string) =>
    startTransition(() => {
      setSelected(next)
      router.push(`${pathname}${qs}`)
    })

  const applyMonth = (m: string) => {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) apply({ key: "pick-month", from: `${m}-01`, to: `${m}-01` }, `?month=${m}`)
  }
  const applyCustom = (f: string, t: string) => {
    if (f && t) apply({ key: "custom", from: f, to: t }, `?from=${f}&to=${t}`)
  }

  const onPick = (key: RangeKey) => {
    setMode(key)
    if (key === "fy") apply({ key, from: "", to: "" }, "")
    else if (key === "month") apply({ key, from: "", to: "" }, "?range=month")
    else if (key === "pick-month") applyMonth(month)
    else applyCustom(from, to)
  }

  return (
    <div data-ui="admin/DashboardRangeShell" className="space-y-6">
      <div data-ui="admin/DashboardRangeShell/div-flex" className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <SelectField
          label="Date range"
          hideLabel
          fieldSize="md"
          noErrorSpace
          containerClassName="w-full sm:w-56"
          value={mode}
          onValueChange={(v) => onPick(v as RangeKey)}
          options={RANGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
        />
        {mode === "pick-month" && (
          <div data-ui="admin/DashboardRangeShell/div-choose-a-month" className="flex items-end gap-2" role="group" aria-label="Choose a month">
            <CalendarRangeIcon className="mb-2.5 size-4 text-primary" aria-hidden />
            <TextField
              label="Month"
              hideLabel
              type="month"
              fieldSize="md"
              max={today.slice(0, 7)}
              value={month}
              onChange={(e) => {
                setMonth(e.target.value)
                applyMonth(e.target.value)
              }}
              containerClassName="w-44"
              noErrorSpace
            />
          </div>
        )}
        {mode === "custom" && (
          <div data-ui="admin/DashboardRangeShell/div-custom-date-range" className="flex items-end gap-2" role="group" aria-label="Custom date range">
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
              containerClassName="w-40"
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
              containerClassName="w-40"
              noErrorSpace
            />
          </div>
        )}
        <p data-ui="admin/DashboardRangeShell/p" className="mb-2.5 text-sm text-muted-foreground" aria-live="polite">
          Showing: <span data-ui="admin/DashboardRangeShell/span-2" className="font-medium text-foreground">{selected.key === "fy" ? "this financial year" : selected.key === "month" ? "this month" : selected.key === "pick-month" ? selected.from.slice(0, 7) : `${selected.from} to ${selected.to}`}</span>
        </p>
      </div>
      <div data-ui="admin/DashboardRangeShell/div" aria-busy={pending}>
        {pending ? <DashboardSkeleton /> : children}
      </div>
    </div>
  )
}

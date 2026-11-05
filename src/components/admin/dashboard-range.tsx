"use client"

import { CalendarRangeIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useOptimistic, useState, useTransition, type ReactNode } from "react"
import { TextField } from "@/components/form"
import { RANGE_PRESETS, type RangeKey } from "@/features/orders/dashboard-range"
import { cn } from "@/lib/utils"

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
 * Chips respond instantly; a skeleton shows while new numbers load; you can pick again at any time.
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
  const [from, setFrom] = useState(current.key === "custom" ? current.from : "")
  const [to, setTo] = useState(current.key === "custom" ? current.to : "")

  const apply = (next: Selected, qs: string) =>
    startTransition(() => {
      setSelected(next)
      router.push(`${pathname}${qs}`)
    })

  const pickPreset = (key: RangeKey) => apply({ key, from: "", to: "" }, key === "30d" ? "" : `?range=${key}`)
  const applyCustom = (f: string, t: string) => {
    if (f && t) apply({ key: "custom", from: f, to: t }, `?from=${f}&to=${t}`)
  }

  return (
    <div data-ui="admin/DashboardRangeShell" className="space-y-6">
      <div data-ui="admin/DashboardRangeShell/div-flex" className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div data-ui="admin/DashboardRangeShell/div-date-range" className="scroll-row flex items-center gap-2" role="group" aria-label="Date range">
          {RANGE_PRESETS.map((p) => (
            <button data-ui="admin/DashboardRangeShell/button"
              key={p.key}
              type="button"
              aria-pressed={selected.key === p.key}
              onClick={() => pickPreset(p.key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                selected.key === p.key ? "border-transparent bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div data-ui="admin/DashboardRangeShell/div-custom-date-range" className="flex items-end gap-2" role="group" aria-label="Custom date range">
          <CalendarRangeIcon className={cn("mb-2.5 size-4", selected.key === "custom" ? "text-primary" : "text-muted-foreground")} aria-hidden />
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
          <span data-ui="admin/DashboardRangeShell/span" className="mb-2.5 text-sm text-muted-foreground">to</span>
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
      </div>
      <div data-ui="admin/DashboardRangeShell/div" aria-busy={pending}>{pending ? <DashboardSkeleton /> : children}</div>
    </div>
  )
}

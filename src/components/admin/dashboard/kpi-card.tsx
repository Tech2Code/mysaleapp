import type { LucideIcon } from "lucide-react"
import { Sparkline } from "@/components/admin/charts"
import { cn } from "@/lib/utils"
import { Delta } from "./delta"

const KPI_TONES = {
  emerald: "text-emerald-500 dark:text-emerald-400",
  sky: "text-sky-500 dark:text-sky-400",
  violet: "text-primary",
} as const

export function KpiCard({
  label,
  period,
  value,
  icon: Icon,
  tone,
  delta,
  showDelta,
  series,
  seriesLabel,
}: {
  label: string
  period: string
  value: string
  icon: LucideIcon
  tone: keyof typeof KPI_TONES
  delta: number | null
  showDelta: boolean
  series: number[]
  seriesLabel: string
}) {
  return (
    <div
      data-ui="admin/KpiCard"
      className="adminCardInteractive relative flex h-full flex-col overflow-hidden rounded-xl border"
    >
      <div data-ui="admin/KpiCard/div" className="flex-1 p-4 pb-1 sm:p-5 sm:pb-1">
        <div data-ui="admin/KpiCard/div-flex" className="flex items-center justify-between gap-2">
          <div data-ui="admin/KpiCard/div-flex-2" className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <p data-ui="admin/KpiCard/p" className="text-xs font-medium">{label}</p>
          </div>
          <Delta value={delta} show={showDelta} />
        </div>
        <p data-ui="admin/KpiCard/p-2" className="mt-3 font-heading text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-[28px]">
          {value}
        </p>
        <p data-ui="admin/KpiCard/p-3" className="mt-1.5 text-[11px] text-muted-foreground">
          {period}
          {showDelta && " · vs prev"}
        </p>
      </div>
      <Sparkline data={series} label={seriesLabel} className={cn("h-11", KPI_TONES[tone])} />
    </div>
  )
}

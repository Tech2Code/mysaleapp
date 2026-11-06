import type { LucideIcon } from "lucide-react"
import { Sparkline } from "@/components/admin/charts"
import { cn } from "@/lib/utils"
import { Delta } from "./delta"

const KPI_TONES = {
  emerald: {
    glow: "from-emerald-500/12 dark:from-emerald-400/10",
    chip: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
    line: "text-emerald-500 dark:text-emerald-400",
  },
  sky: {
    glow: "from-sky-500/12 dark:from-sky-400/10",
    chip: "bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
    line: "text-sky-500 dark:text-sky-400",
  },
  violet: {
    glow: "from-violet-500/12 dark:from-violet-400/10",
    chip: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
    line: "text-violet-500 dark:text-violet-400",
  },
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
  const t = KPI_TONES[tone]
  return (
    <div
      data-ui="admin/KpiCard"
      className={cn("relative flex h-full flex-col overflow-hidden rounded-2xl border bg-linear-to-br to-card to-60% bg-card shadow-xs transition-shadow hover:shadow-md", t.glow)}
    >
      <div data-ui="admin/KpiCard/div" className="flex-1 p-5 pb-3">
        <div data-ui="admin/KpiCard/div-flex" className="flex items-start justify-between gap-3">
          <span data-ui="admin/KpiCard/span" className={cn("grid size-10 shrink-0 place-items-center rounded-xl", t.chip)}>
            <Icon className="size-5" aria-hidden />
          </span>
          <Delta value={delta} show={showDelta} />
        </div>
        <p data-ui="admin/KpiCard/p" className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
        <p data-ui="admin/KpiCard/p-2" className="mt-1 font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums sm:text-4xl">{value}</p>
        <p data-ui="admin/KpiCard/p-3" className="mt-2 text-xs text-muted-foreground">
          {period}
          {showDelta && " · vs previous period"}
        </p>
      </div>
      <Sparkline data={series} label={seriesLabel} className={cn("h-14", t.line)} />
    </div>
  )
}

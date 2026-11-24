import type { LucideIcon } from "lucide-react"
import styles from "@/components/admin/admin-core.module.css"
import { Sparkline } from "@/components/admin/charts"
import { cn } from "@/lib/utils"
import { Delta } from "./delta"

const KPI_TONES = {
  emerald: styles.kpiToneEmerald,
  sky: styles.kpiToneSky,
  violet: styles.kpiToneViolet,
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

      className={cn("adminCardInteractive", styles.kpiCard)}
    >
      <div className={styles.kpiBody}>
        <div className={styles.kpiTopRow}>
          <div className={styles.kpiLabelGroup}>
            <Icon className={styles.icon14} aria-hidden />
            <p className={styles.kpiLabelText}>{label}</p>
          </div>
          <Delta value={delta} show={showDelta} />
        </div>
        <p className={styles.kpiValueText}>
          {value}
        </p>
        <p className={styles.kpiPeriodText}>
          {period}
          {showDelta && " · vs prev"}
        </p>
      </div>
      <Sparkline data={series} label={seriesLabel} className={cn(styles.kpiSparkline, KPI_TONES[tone])} />
    </div>
  )
}

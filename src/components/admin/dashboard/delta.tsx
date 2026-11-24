import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"
import styles from "@/components/admin/admin-core.module.css"
import { cn } from "@/lib/utils"

/** % change vs the previous period. null = nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

export function Delta({ value, show = true }: { value: number | null; show?: boolean }) {
  if (!show) return null
  if (value === null) {
    return (
      <span className={styles.deltaNewBadge}>
        New
      </span>
    )
  }
  const up = value >= 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span

      className={cn(
        styles.deltaBadge,
        up ? styles.deltaUp : styles.deltaDown
      )}
    >
      <Icon className={styles.icon12} aria-hidden />
      {Math.abs(value)}%<span className={styles.srOnly}> {up ? "up" : "down"} from the previous period</span>
    </span>
  )
}

import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react"
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
      <span data-ui="admin/Delta" className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        New
      </span>
    )
  }
  const up = value >= 0
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon
  return (
    <span
      data-ui="admin/Delta"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        up
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
          : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(value)}%<span data-ui="admin/Delta/span" className="sr-only"> {up ? "up" : "down"} from the previous period</span>
    </span>
  )
}

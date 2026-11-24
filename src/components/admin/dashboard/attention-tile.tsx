import { ArrowRightIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const TONES = {
  sky: "bg-sky-500/12 text-sky-700 ring-1 ring-sky-500/20 dark:bg-sky-400/15 dark:text-sky-300",
  amber: "bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-400/15 dark:text-amber-300",
  violet: "bg-violet-500/12 text-violet-700 ring-1 ring-violet-500/20 dark:bg-violet-400/15 dark:text-violet-300",
  rose: "bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/20 dark:bg-rose-400/15 dark:text-rose-300",
} as const

export function AttentionTile({
  href,
  icon: Icon,
  tone,
  count,
  label,
  hint,
  pulse,
}: {
  href: string
  icon: LucideIcon
  tone: keyof typeof TONES
  count: number
  label: string
  hint: string
  pulse?: boolean
}) {
  const active = count > 0
  return (
    <Link
      data-ui="admin/AttentionTile"
      href={href}
      className={cn(
        "adminCardInteractive group flex items-center gap-3 rounded-2xl border p-3.5 hover:-translate-y-0.5 active:scale-[0.99] sm:gap-3.5 sm:p-4",
        active ? "border-border" : "opacity-75 hover:opacity-100"
      )}
    >
      <span data-ui="admin/AttentionTile/span" className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl sm:size-11", TONES[tone])}>
        {pulse && active && (
          <span data-ui="admin/AttentionTile/span-absolute" aria-hidden className="absolute -top-1 -right-1 size-2.5 rounded-full bg-current ring-2 ring-card" />
        )}
        <Icon className="relative size-4.5 sm:size-5" aria-hidden />
      </span>
      <div data-ui="admin/AttentionTile/div" className="min-w-0 flex-1">
        <div data-ui="admin/AttentionTile/div-flex" className="flex items-baseline justify-between gap-2">
          <p data-ui="admin/AttentionTile/p" className="font-heading text-xl leading-none font-semibold tabular-nums sm:text-2xl">{count}</p>
          <ArrowRightIcon className="hidden size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" aria-hidden />
        </div>
        <p data-ui="admin/AttentionTile/p-2" className="mt-1.5 truncate text-xs font-semibold text-foreground sm:text-sm">{label}</p>
        <p data-ui="admin/AttentionTile/p-hidden" className="hidden truncate text-[11px] text-muted-foreground sm:block">{active ? hint : "All clear"}</p>
      </div>
    </Link>
  )
}

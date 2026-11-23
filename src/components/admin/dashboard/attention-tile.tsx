import { ArrowRightIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const TONES = {
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
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
    <Link data-ui="admin/AttentionTile"
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] sm:gap-4 sm:p-4",
        active ? "shadow-xs" : "opacity-75"
      )}
    >
      <span data-ui="admin/AttentionTile/span" className={cn("relative grid size-10 shrink-0 place-items-center rounded-xl sm:size-11 sm:rounded-2xl", TONES[tone])}>
        {pulse && active && (
          <span data-ui="admin/AttentionTile/span-absolute" aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-current ring-2 ring-card" />
        )}
        <Icon className="relative size-4.5 sm:size-5" aria-hidden />
      </span>
      <div data-ui="admin/AttentionTile/div" className="min-w-0 flex-1">
        <p data-ui="admin/AttentionTile/p" className="font-heading text-xl leading-none font-semibold tabular-nums sm:text-2xl">{count}</p>
        <p data-ui="admin/AttentionTile/p-2" className="mt-1 truncate text-xs font-medium sm:text-sm">{label}</p>
        <p data-ui="admin/AttentionTile/p-hidden" className="hidden truncate text-xs text-muted-foreground sm:block">{active ? hint : "All clear"}</p>
      </div>
      <ArrowRightIcon className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
    </Link>
  )
}

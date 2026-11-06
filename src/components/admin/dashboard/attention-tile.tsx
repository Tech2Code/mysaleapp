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
        "group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        active ? "shadow-xs" : "opacity-80"
      )}
    >
      <span data-ui="admin/AttentionTile/span" className={cn("relative grid size-12 shrink-0 place-items-center rounded-2xl", TONES[tone])}>
        {pulse && active && (
          <span data-ui="admin/AttentionTile/span-absolute" aria-hidden className="absolute inset-0 animate-ping rounded-2xl bg-current opacity-20 animation-duration-[2.4s]" />
        )}
        <Icon className="relative size-5" aria-hidden />
      </span>
      <div data-ui="admin/AttentionTile/div" className="min-w-0 flex-1">
        <p data-ui="admin/AttentionTile/p" className="font-heading text-2xl leading-none font-semibold">{count}</p>
        <p data-ui="admin/AttentionTile/p-2" className="mt-1 truncate text-sm font-medium">{label}</p>
        <p data-ui="admin/AttentionTile/p-3" className="truncate text-xs text-muted-foreground">{active ? hint : "All clear"}</p>
      </div>
      <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

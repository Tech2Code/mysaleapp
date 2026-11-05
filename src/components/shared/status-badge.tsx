import { CheckCircle2Icon, CircleDashedIcon, PackageIcon, TruckIcon, XCircleIcon, BadgeCheckIcon } from "lucide-react"
import { STATUS_META, type OrderStatus } from "@/features/orders/types"
import { cn } from "@/lib/utils"

const ICONS: Record<OrderStatus, typeof TruckIcon> = {
  pending: CircleDashedIcon,
  confirmed: BadgeCheckIcon,
  packed: PackageIcon,
  shipped: TruckIcon,
  delivered: CheckCircle2Icon,
  cancelled: XCircleIcon,
}

const TONES = {
  neutral: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  progress: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
} as const

/** Status pill — icon + text, so colour is never the only signal. */
export function StatusBadge({
  status,
  className,
  pulse = false,
}: {
  status: OrderStatus
  className?: string
  /** Adds a soft pulsing ring behind the icon. Use on single-order views, not in long lists. */
  pulse?: boolean
}) {
  const meta = STATUS_META[status]
  const Icon = ICONS[status]
  return (
    <span data-ui="shared/StatusBadge"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONES[meta.tone],
        className
      )}
    >
      <span data-ui="shared/StatusBadge/span-grid" className="relative grid place-items-center">
        {pulse && (
          <span data-ui="shared/StatusBadge/span-absolute" aria-hidden className="absolute inset-0 rounded-full bg-current opacity-30 animate-ping animation-duration-[2.2s]" />
        )}
        <Icon className="relative size-3.5" aria-hidden />
      </span>
      {meta.label}
    </span>
  )
}

import { CheckCircle2Icon, CircleDashedIcon, PackageIcon, TruckIcon, XCircleIcon, BadgeCheckIcon } from "lucide-react"
import { STATUS_META, type OrderStatus } from "@/features/orders/types"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

const ICONS: Record<OrderStatus, typeof TruckIcon> = {
  pending: CircleDashedIcon,
  confirmed: BadgeCheckIcon,
  packed: PackageIcon,
  shipped: TruckIcon,
  delivered: CheckCircle2Icon,
  cancelled: XCircleIcon,
}

export const TONES = {
  neutral: styles.toneNeutral,
  info: styles.toneInfo,
  progress: styles.toneProgress,
  success: styles.toneSuccess,
  danger: styles.toneDanger,
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
    <span
      className={cn(
        styles.badgePillBase,
        TONES[meta.tone],
        className
      )}
    >
      <span className={styles.badgeIconWrap}>
        {pulse && (
          <span aria-hidden className={styles.badgePulseRing} />
        )}
        <Icon className={styles.badgeIconRel} aria-hidden />
      </span>
      {meta.label}
    </span>
  )
}

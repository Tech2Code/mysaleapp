import { BanIcon, CheckCircle2Icon, ClockIcon, HandCoinsIcon, HourglassIcon, Undo2Icon, XCircleIcon } from "lucide-react"
import {
  paymentDisplay,
  PAYMENT_STATUS_LABEL,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentTone,
} from "@/features/orders/types"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

export const PAYMENT_TONE_STYLE: Record<PaymentTone, { icon: typeof ClockIcon; className: string }> = {
  pending: { icon: ClockIcon, className: styles.toneNeutral },
  submitted: { icon: HourglassIcon, className: styles.toneInfo },
  paid: { icon: CheckCircle2Icon, className: styles.toneSuccess },
  failed: { icon: XCircleIcon, className: styles.toneDanger },
  refunded: { icon: Undo2Icon, className: styles.toneSlateRefunded },
  cancelled: { icon: BanIcon, className: styles.toneSlateCancelled },
  refund_due: { icon: HandCoinsIcon, className: styles.toneOrangeRefundDue },
}

/**
 * Payment status pill (icon + text, so colour is never the only signal).
 * Pass `orderStatus` so cancelled orders read "No payment due" / "Refund due" instead of "Awaiting payment".
 */
export function PaymentBadge({
  status,
  orderStatus,
  method = null,
  refundedAmount = 0,
  paidAmount = 0,
  className,
}: {
  status: PaymentStatus
  orderStatus?: OrderStatus
  method?: PaymentMethod | null
  /** For a partly refunded paid order: shows "Partially refunded ₹X of ₹Y". */
  refundedAmount?: number
  paidAmount?: number
  className?: string
}) {
  const { label, detail, tone } = orderStatus
    ? paymentDisplay(orderStatus, status, method, { refundedAmount, paidAmount })
    : { label: PAYMENT_STATUS_LABEL[status], detail: undefined, tone: status as PaymentTone }
  const { icon: Icon, className: toneClass } = PAYMENT_TONE_STYLE[tone]

  const pill = (
    <span className={cn(styles.badgePillBase, toneClass, className)}>
      <Icon className={styles.icon14} aria-hidden />
      {label}
    </span>
  )

  if (!detail) return pill

  return (
    <span className={styles.paymentBadgeGroup}>
      {pill}
      <span className={styles.paymentBadgeDetail}>{detail}</span>
    </span>
  )
}

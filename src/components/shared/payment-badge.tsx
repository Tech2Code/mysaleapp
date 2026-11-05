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

export const PAYMENT_TONE_STYLE: Record<PaymentTone, { icon: typeof ClockIcon; className: string }> = {
  pending: { icon: ClockIcon, className: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200" },
  submitted: { icon: HourglassIcon, className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200" },
  paid: { icon: CheckCircle2Icon, className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200" },
  failed: { icon: XCircleIcon, className: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200" },
  refunded: { icon: Undo2Icon, className: "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200" },
  cancelled: { icon: BanIcon, className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  refund_due: { icon: HandCoinsIcon, className: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200" },
}

/**
 * Payment status pill (icon + text, so colour is never the only signal).
 * Pass `orderStatus` so cancelled orders read "No payment due" / "Refund due" instead of "Awaiting payment".
 */
export function PaymentBadge({
  status,
  orderStatus,
  method = null,
  className,
}: {
  status: PaymentStatus
  orderStatus?: OrderStatus
  method?: PaymentMethod | null
  className?: string
}) {
  const { label, tone } = orderStatus
    ? paymentDisplay(orderStatus, status, method)
    : { label: PAYMENT_STATUS_LABEL[status], tone: status as PaymentTone }
  const { icon: Icon, className: toneClass } = PAYMENT_TONE_STYLE[tone]

  return (
    <span data-ui="shared/PaymentBadge" className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", toneClass, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}

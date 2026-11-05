import { BanIcon, CircleCheckIcon, Clock3Icon } from "lucide-react"
import type { Cancellation, PaymentStatus } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"

/**
 * Shown on a cancelled order: who cancelled, why, and what happens to any money already paid.
 * `audience` only changes the wording ("You cancelled" vs "Cancelled by the customer").
 */
export function CancellationNotice({
  cancellation,
  paymentStatus,
  audience,
}: {
  cancellation: Cancellation
  paymentStatus: PaymentStatus
  audience: "customer" | "admin"
}) {
  const paidOrSent = paymentStatus === "paid" || paymentStatus === "submitted"
  const refunded = paymentStatus === "refunded"

  const who =
    cancellation.by === "customer"
      ? audience === "customer"
        ? "You cancelled this order"
        : "Cancelled by the customer"
      : cancellation.by === "system"
        ? audience === "customer"
          ? "This order was cancelled automatically"
          : "Cancelled automatically (unpaid)"
      : cancellation.by === "admin"
        ? audience === "customer"
          ? "The shop cancelled this order"
          : "Cancelled by you"
        : "This order was cancelled"

  return (
    <section
      data-ui="shared/CancellationNotice"
      aria-label="Cancellation details"
      className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5"
    >
      <p data-ui="shared/CancellationNotice/p-flex" className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-destructive">
        <BanIcon className="size-4 shrink-0" aria-hidden /> {who}
        {cancellation.at && <span data-ui="shared/CancellationNotice/span" className="text-xs font-normal text-muted-foreground">· {formatDateTime(cancellation.at)}</span>}
      </p>
      {cancellation.reason && (
        <p data-ui="shared/CancellationNotice/p" className="text-sm">
          <span data-ui="shared/CancellationNotice/span-2" className="text-muted-foreground">Reason: </span>
          {cancellation.reason}
        </p>
      )}
      {refunded ? (
        <p data-ui="shared/CancellationNotice/p-flex-2" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-foreground">
          <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span data-ui="shared/CancellationNotice/span-3">
            Refund done{cancellation.refundedAt ? ` on ${formatDateTime(cancellation.refundedAt)}` : ""}.
            {cancellation.refundReference ? ` Reference: ${cancellation.refundReference}.` : ""}
          </span>
        </p>
      ) : paidOrSent ? (
        <p data-ui="shared/CancellationNotice/p-flex-3" className="flex items-start gap-2 rounded-xl bg-amber-100 p-3 text-sm text-amber-950 dark:bg-amber-900/30 dark:text-amber-100">
          <Clock3Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span data-ui="shared/CancellationNotice/span-4">
            {audience === "customer"
              ? "Your refund will be sent to the account you paid from within a few working days. We'll message you once it's done."
              : "Payment was received. Send the refund and mark the payment as Refunded."}
          </span>
        </p>
      ) : (
        <p data-ui="shared/CancellationNotice/p-2" className="text-sm text-muted-foreground">No payment was made, so there is nothing to refund.</p>
      )}
    </section>
  )
}

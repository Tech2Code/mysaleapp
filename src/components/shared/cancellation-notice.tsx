import { BanIcon, CircleCheckIcon, Clock3Icon, WalletIcon } from "lucide-react"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { splitCancelReason } from "@/features/orders/reasons"
import type { Cancellation, PaymentStatus } from "@/features/orders/types"
import { formatDateTime } from "@/lib/format"
import styles from "./shared.module.css"

/**
 * Shown on a cancelled order: who cancelled, why, and what happens to any money already paid.
 * `audience` only changes the wording ("You cancelled" vs "Cancelled by the customer").
 */
export function CancellationNotice({
  cancellation,
  paymentStatus,
  audience,
  showPrivateRefs = true,
}: {
  cancellation: Cancellation
  paymentStatus: PaymentStatus
  audience: "customer" | "admin"
  showPrivateRefs?: boolean
}) {
  const paidOrSent = paymentStatus === "paid" || paymentStatus === "submitted"
  const refunded = paymentStatus === "refunded"
  const { reason: cleanReason, refundUpiId } = splitCancelReason(cancellation.reason)

  const who =
    cancellation.by === "customer"
      ? audience === "customer"
        ? "You cancelled this order"
        : "Cancelled by the customer"
      : cancellation.by === "system"
        ? audience === "customer"
          ? "This order was cancelled automatically"
          : "Cancelled automatically (payment not verified in time)"
      : cancellation.by === "admin"
        ? audience === "customer"
          ? "The shop cancelled this order"
          : "Cancelled by you"
        : "This order was cancelled"

  return (
    <section

      aria-label="Cancellation details"
      className={styles.cancellationCard}
    >
      <p className={styles.cancelHeadingRow}>
        <BanIcon className={styles.icon16} aria-hidden /> {who}
        {cancellation.at && <span className={styles.cancelTimeSpan}>· {formatDateTime(cancellation.at)}</span>}
      </p>
      {cleanReason && (
        <p className={styles.cancelReasonLine}>
          <span className={styles.mutedLabel}>Reason: </span>
          {cleanReason}
        </p>
      )}
      {refundUpiId && showPrivateRefs && (
        <p className={styles.cancelReasonLine}>
          <WalletIcon className={styles.icon14} aria-hidden />{" "}
          <span className={styles.mutedLabel}>Refund UPI ID: </span>
          {audience === "admin" ? <CopyableReference value={refundUpiId} /> : <span className={styles.refMonoText}>{refundUpiId}</span>}
        </p>
      )}
      {refunded ? (
        <p className={styles.refundDoneBanner}>
          <CircleCheckIcon className={styles.successIcon} aria-hidden />
          <span>
            Refund done{cancellation.refundedAt ? ` on ${formatDateTime(cancellation.refundedAt)}` : ""}.
            {cancellation.refundReference ? ` Reference: ${cancellation.refundReference}.` : ""}
          </span>
        </p>
      ) : paidOrSent ? (
        <p className={styles.refundPendingBanner}>
          <Clock3Icon className={styles.clockIcon} aria-hidden />
          <span>
            {audience === "customer"
              ? refundUpiId && showPrivateRefs
                ? `Your refund will be sent to ${refundUpiId} within a few working days. We'll message you once it's done.`
                : "Your refund will be sent to the account you paid from within a few working days. We'll message you once it's done."
              : "Payment was received. Send the refund and mark the payment as Refunded."}
          </span>
        </p>
      ) : (
        <p className={styles.noPaymentText}>No payment was verified for this order, so there is nothing to refund.</p>
      )}
    </section>
  )
}

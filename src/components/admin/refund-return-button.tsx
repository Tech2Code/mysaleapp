"use client"

import { Loader2Icon, SmartphoneIcon, WalletIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { useToastAfter } from "@/hooks/use-toast-after"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { refundReturn } from "@/features/orders/admin-actions"
import { buildUpiUrl } from "@/features/orders/upi"
import { formatPrice } from "@/lib/format"
import styles from "./admin-orders.module.css"

/**
 * "Mark refunded" for ONE return that was recorded without a refund. `value` is only shown (the server prices the
 * return from the order's items); `expectedRefunded` is what this screen showed, so a double click can't refund twice.
 */
export function RefundReturnButton({
  returnId,
  value,
  expectedRefunded,
  refundUpiId,
  paymentReference,
  customerName,
  orderCode,
}: {
  returnId: string
  value: number
  expectedRefunded: number
  refundUpiId?: string | null
  paymentReference?: string | null
  customerName?: string
  orderCode?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const upiLink =
    refundUpiId && value > 0
      ? buildUpiUrl({
          upiId: refundUpiId,
          payeeName: customerName,
          amount: value,
          orderCode: orderCode ? `${orderCode} Refund` : "Return Refund",
        })
      : null

  const run = () =>
    startTransition(async () => {
      const res = await refundReturn({ returnId, expectedRefunded })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success(res.data.fullyRefunded ? "Refund recorded. Payment marked refunded." : `Refund recorded (${formatPrice(res.data.refundedAmount)} refunded so far).`)
      })
      router.refresh()
    })

  return (
    <div className={styles.returnRefundActionStack}>
      {(refundUpiId || paymentReference) && (
        <div className={styles.refundHelperCard}>
          <p className={styles.refundHelperTitle}>
            <WalletIcon className={styles.iconSm} aria-hidden /> Send {formatPrice(value)} to customer:
          </p>
          {refundUpiId && (
            <div className={styles.refundUpiHighlight}>
              <div>
                <span className={styles.mutedSpan}>Refund UPI ID: </span>
                <CopyableReference value={refundUpiId} />
              </div>
              {upiLink && (
                <a href={upiLink} className={buttonVariants({ variant: "primary", size: "xs" })}>
                  <SmartphoneIcon className={styles.iconSm} aria-hidden /> Pay {formatPrice(value)} via UPI
                </a>
              )}
            </div>
          )}
          {paymentReference && (
            <p className={styles.refundHelperStep}>
              <strong>Original UTR lookup:</strong> Search UTR <CopyableReference value={paymentReference} /> in your Bank / UPI app and pay back to sender.
            </p>
          )}
        </div>
      )}
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setOpen(true)} className={styles.pillBtn}>
        {pending && <Loader2Icon className={styles.spinIcon} />} I have refunded {formatPrice(value)}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !pending && setOpen(o)}
        title={`Record a refund of ${formatPrice(value)}?`}
        description="Only do this after you have sent the money back to the customer. It marks this return as refunded."
        confirmLabel="Yes, I have refunded"
        pending={pending}
        onConfirm={run}
      />
    </div>
  )
}

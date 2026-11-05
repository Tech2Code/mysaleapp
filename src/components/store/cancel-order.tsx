"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrder } from "@/features/orders/actions"
import { CANCELLABLE_BY_CUSTOMER, CANCEL_REASONS } from "@/features/orders/transitions"
import type { OrderStatus, PaymentStatus } from "@/features/orders/types"

/**
 * "Cancel order" for customers. Available until the order is packed; after that it points to WhatsApp.
 * `onCancelled` lets a page that holds the order in state (the track page) reload it.
 */
export function CancelOrder({
  orderCode,
  phoneLast4,
  status,
  paymentStatus,
  whatsappUrl,
  onCancelled,
}: {
  orderCode: string
  phoneLast4?: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  whatsappUrl: string
  onCancelled?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0])
  const [detail, setDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (status === "cancelled" || status === "delivered") return null

  if (!CANCELLABLE_BY_CUSTOMER.includes(status)) {
    return (
      <p data-ui="store/CancelOrder" className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
        Need to cancel? This order is already {status === "shipped" ? "on its way" : "packed"}.{" "}
        <a data-ui="store/CancelOrder/a-message-us-on-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
          Message us on WhatsApp
        </a>{" "}
        and we&apos;ll help.
      </p>
    )
  }

  const paid = paymentStatus === "paid" || paymentStatus === "submitted"
  const reasonText = reason === "Other" ? detail.trim() || "Other" : detail.trim() ? `${reason}: ${detail.trim()}` : reason

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await cancelOrder({ code: orderCode, phoneLast4, reason: reasonText.slice(0, 300) })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      toast.success(res.data.refundDue ? "Order cancelled. Your refund is on its way." : "Order cancelled")
      onCancelled?.()
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        data-ui="store/CancelOrder/DialogTrigger-inline-flex"
        className="inline-flex h-11 items-center justify-center rounded-full border border-destructive/40 px-6 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Cancel order
      </DialogTrigger>
      <DialogContent data-ui="store/CancelOrder/DialogContent">
        <DialogHeader>
          <DialogTitle>Cancel order {orderCode}?</DialogTitle>
          <DialogDescription>
            {paid
              ? "You've already paid for this order. If you cancel it, we'll refund the full amount to the account you paid from."
              : "No payment has been made, so you won't be charged."}{" "}
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div data-ui="store/CancelOrder/div" className="space-y-1">
          <SelectField
            label="Why are you cancelling?"
            fieldSize="md"
            value={reason}
            onValueChange={setReason}
            options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
          />
          <TextAreaField
            label="Anything else? (optional)"
            rows={2}
            maxLength={200}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          {error && (
            <p data-ui="store/CancelOrder/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button data-ui="store/CancelOrder/Button-keep-order" type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Keep order
          </Button>
          <Button data-ui="store/CancelOrder/Button-yes-cancel-order" type="button" variant="destructive" onClick={submit} disabled={pending} className="rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} Yes, cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

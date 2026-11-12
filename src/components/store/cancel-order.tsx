"use client"

import { BanIcon, CheckIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { normalizeIndianPhone } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrder } from "@/features/orders/actions"
import { CANCELLABLE_BY_CUSTOMER, CANCEL_REASONS } from "@/features/orders/transitions"
import type { OrderStatus, PaymentStatus } from "@/features/orders/types"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"
import { LIMITS } from "@/lib/validation"

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
  const [reason, setReason] = useState<string>("")
  const [detail, setDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [phone, setPhone] = useState("")
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  useRevealOnChange(status)

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
  const needsDetail = !reason || otherNeedsDetail(reason, detail)
  // A guest (the track page passes their last 4 digits) must type the FULL number to cancel; a signed-in owner
  // (no phoneLast4) is recognised by their account.
  const isGuest = phoneLast4 !== undefined
  const phoneDigits = normalizeIndianPhone(phone)
  const phoneError =
    isGuest && phone.trim() && !phoneDigits
      ? "Enter your 10-digit mobile number"
      : isGuest && phoneDigits && !phoneDigits.endsWith(phoneLast4)
        ? "Doesn't match the number you looked up"
        : undefined
  const phoneMissing = isGuest && (!phoneDigits || Boolean(phoneError))

  const submit = () =>
    startTransition(async () => {
      setError(null)
      if (!reason) {
        setError("Please select why you are cancelling.")
        return
      }
      const res = await cancelOrder({
        code: orderCode,
        phoneLast4,
        phone: isGuest ? phoneDigits ?? undefined : undefined,
        reason,
        detail: detail.trim() || undefined,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      later(() => {
        setOpen(false)
        onCancelled?.()
        toast.success(res.data.refundDue ? "Order cancelled. Your refund is on its way." : "Order cancelled")
      })
      router.refresh()
    })

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setDetail("")
      setPhone("")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        data-ui="store/CancelOrder/DialogTrigger-inline-flex"
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-destructive/40 px-6 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <BanIcon className="size-4" /> Cancel order
      </DialogTrigger>
      <DialogContent data-ui="store/CancelOrder/DialogContent" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order {orderCode}?</DialogTitle>
          <DialogDescription>
            {paid
              ? "You've already paid for this order. If you cancel it, we'll refund the full amount to the account you paid from."
              : "No payment has been made, so you won't be charged."}{" "}
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div data-ui="store/CancelOrder/div" className="space-y-1">
            <SelectField
              label="Why are you cancelling? *"
              placeholder="Select a reason"
              fieldSize="md"
              value={reason}
              onValueChange={setReason}
              options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
            />
            <TextAreaField
              label={reason === OTHER_REASON ? "Please tell us the reason" : "Anything else? (optional)"}
              required={reason === OTHER_REASON}
              rows={2}
              maxLength={LIMITS.cancelDetail.max}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              error={needsDetail && detail.trim() ? OTHER_DETAIL_MESSAGE : undefined}
            />
            {isGuest && (
              <TextField
                label="Your full mobile number"
                kind="phone"
                leading="+91"
                hint="To cancel, confirm the whole number you ordered with."
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={phoneError}
              />
            )}
            {error && (
              <p data-ui="store/CancelOrder/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button data-ui="store/CancelOrder/Button-keep-order" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <CheckIcon className="size-4" /> Keep order
          </Button>
          <Button data-ui="store/CancelOrder/Button-yes-cancel-order" type="button" variant="destructive" onClick={submit} disabled={pending || needsDetail || phoneMissing} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <BanIcon className="size-4" />} Yes, cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

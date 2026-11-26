"use client"

import { BanIcon, CheckIcon, Loader2Icon, WalletIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { normalizeIndianPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrder } from "@/features/orders/actions"
import { CANCELLABLE_BY_CUSTOMER, CANCEL_REASONS } from "@/features/orders/transitions"
import type { OrderStatus, PaymentStatus } from "@/features/orders/types"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"
import { LIMITS, PATTERNS } from "@/lib/validation"
import styles from "./order-status.module.css"

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
  onCancelled?: () => void | Promise<unknown>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>("")
  const [detail, setDetail] = useState("")
  const [refundMode, setRefundMode] = useState<"original" | "upi">("original")
  const [refundUpiId, setRefundUpiId] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const [phone, setPhone] = useState("")
  const formFieldsRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  useRevealOnChange(status)

  useEffect(() => {
    return () => {
      setOpen(false)
      setReason("")
      setDetail("")
      setRefundMode("original")
      setRefundUpiId("")
      setPhone("")
      setSubmitted(false)
      setTouched({})
      setServerFieldErrors({})
    }
  }, [])

  if (status === "cancelled" || status === "delivered") return null

  if (!CANCELLABLE_BY_CUSTOMER.includes(status)) {
    return (
      <p className={styles.cancelLockedNotice}>
        Need to cancel? This order is already {status === "shipped" ? "on its way" : "packed"}.{" "}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.waInlineLink}>
          Message us on WhatsApp
        </a>{" "}
        and we&apos;ll help.
      </p>
    )
  }

  const paid = paymentStatus === "paid" || paymentStatus === "submitted"
  const needsDetail = !reason || otherNeedsDetail(reason, detail)
  const cleanRefundUpi = refundUpiId.trim()
  const refundUpiError =
    paid && refundMode === "upi"
      ? !cleanRefundUpi
        ? "Enter your UPI ID for the refund (e.g. name@bank)"
        : !PATTERNS.upiId.test(cleanRefundUpi)
          ? "Enter a valid UPI ID, like name@okaxis"
          : undefined
      : undefined
  const refundUpiInvalid = Boolean(refundUpiError)
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

  const submit = () => {
    setSubmitted(true)
    setServerFieldErrors({})
    if (!reason || needsDetail || refundUpiInvalid || phoneMissing) {
      setTimeout(() => {
        const invalidEl = formFieldsRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")
        if (invalidEl) {
          invalidEl.scrollIntoView({ behavior: "smooth", block: "center" })
          invalidEl.focus({ preventScroll: true })
        }
      }, 50)
      return
    }
    startTransition(async () => {
      const res = await cancelOrder({
        code: orderCode,
        phoneLast4,
        phone: isGuest ? phoneDigits ?? undefined : undefined,
        reason,
        detail: detail.trim() || undefined,
        refundUpiId: paid && refundMode === "upi" ? cleanRefundUpi : undefined,
      })
      if (!res.ok) {
        const nextFieldErrors: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) nextFieldErrors[k] = msgs[0]
        }
        setServerFieldErrors(nextFieldErrors)
        toast.error(res.error)
        return
      }
      if (onCancelled) {
        await onCancelled()
      } else {
        router.refresh()
      }
      later(() => {
        setOpen(false)
        toast.success(res.data.refundDue ? "Order cancelled. Your refund is on its way." : "Order cancelled")
      })
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setDetail("")
      setRefundMode("original")
      setRefundUpiId("")
      setPhone("")
      setSubmitted(false)
      setTouched({})
      setServerFieldErrors({})
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger

        className={styles.cancelTriggerBtn}
      >
        <BanIcon className={styles.banSvg} /> Cancel order
      </DialogTrigger>
      <DialogContent mobileFullScreen className={styles.cancelDialogMax}>
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
          <div ref={formFieldsRef} className={styles.cancelFormFields}>
            <SelectField
              label="Why are you cancelling? *"
              placeholder="Select a reason"
              fieldSize="md"
              value={reason}
              onValueChange={(val) => {
                setReason(val)
                if (serverFieldErrors.reason) setServerFieldErrors((p) => ({ ...p, reason: "" }))
              }}
              options={CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
              error={serverFieldErrors.reason || (submitted && !reason ? "Please select why you are cancelling" : undefined)}
            />
            <TextAreaField
              label={reason === OTHER_REASON ? "Please tell us the reason" : "Anything else? (optional)"}
              required={reason === OTHER_REASON}
              rows={2}
              maxLength={LIMITS.cancelDetail.max}
              value={detail}
              onChange={(e) => {
                setDetail(e.target.value)
                if (serverFieldErrors.detail) setServerFieldErrors((p) => ({ ...p, detail: "" }))
              }}
              onBlur={() => markTouched("detail")}
              error={
                serverFieldErrors.detail ||
                ((submitted || touched.detail) && reason === OTHER_REASON && otherNeedsDetail(reason, detail)
                  ? OTHER_DETAIL_MESSAGE
                  : undefined)
              }
            />
            {paid && (
              <div className={styles.refundModeBox}>
                <p className={styles.refundModeTitle}>
                  <WalletIcon className={styles.refundWalletSvg} aria-hidden /> Where should we send your refund?
                </p>
                <div className={styles.refundModeOptions} role="radiogroup" aria-label="Refund destination">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={refundMode === "original"}
                    onClick={() => setRefundMode("original")}
                    className={cn(
                      styles.refundModeOptionBtn,
                      refundMode === "original" && styles.refundModeOptionActive
                    )}
                  >
                    <span className={styles.refundRadioDot} aria-hidden>
                      {refundMode === "original" && <CheckIcon className={styles.refundRadioCheck} />}
                    </span>
                    <span className={styles.refundOptionTextCol}>
                      <span className={styles.refundOptionHeading}>Original UPI account (via payment UTR)</span>
                      <span className={styles.refundOptionSub}>We trace your 12-digit UTR and refund the sender account</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={refundMode === "upi"}
                    onClick={() => {
                      setRefundMode("upi")
                      requestAnimationFrame(() => {
                        formFieldsRef.current?.querySelector<HTMLElement>("input[placeholder*='okicici']")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                      })
                    }}
                    className={cn(
                      styles.refundModeOptionBtn,
                      refundMode === "upi" && styles.refundModeOptionActive
                    )}
                  >
                    <span className={styles.refundRadioDot} aria-hidden>
                      {refundMode === "upi" && <CheckIcon className={styles.refundRadioCheck} />}
                    </span>
                    <span className={styles.refundOptionTextCol}>
                      <span className={styles.refundOptionHeading}>Enter my UPI ID for faster refund</span>
                      <span className={styles.refundOptionSub}>Share your UPI ID (e.g. name@okaxis) for direct transfer</span>
                    </span>
                  </button>
                </div>
                {refundMode === "upi" && (
                  <TextField
                    label="Your UPI ID for refund *"
                    kind="upiId"
                    fieldSize="md"
                    placeholder="e.g. yourname@okicici"
                    hint="Double-check your UPI ID so your refund reaches you without delay."
                    value={refundUpiId}
                    onChange={(e) => {
                      setRefundUpiId(e.target.value)
                      if (serverFieldErrors.refundUpiId) setServerFieldErrors((p) => ({ ...p, refundUpiId: "" }))
                    }}
                    onBlur={() => markTouched("refundUpiId")}
                    error={
                      serverFieldErrors.refundUpiId ||
                      ((submitted || touched.refundUpiId) ? refundUpiError : undefined)
                    }
                  />
                )}
              </div>
            )}
            {isGuest && (
              <TextField
                label="Your full mobile number"
                kind="phone"
                leading="+91"
                hint="To cancel, confirm the whole number you ordered with."
                required
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  if (serverFieldErrors.phone) setServerFieldErrors((p) => ({ ...p, phone: "" }))
                }}
                onBlur={() => markTouched("phone")}
                error={
                  serverFieldErrors.phone ||
                  ((submitted || touched.phone) && phoneMissing
                    ? (phoneError ?? "Enter your 10-digit mobile number")
                    : undefined)
                }
              />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.dialogPillBtn}>
            <CheckIcon className={styles.btnIcon} /> Keep order
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending} className={styles.dialogPillBtn}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <BanIcon className={styles.btnIcon} />} Yes, cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

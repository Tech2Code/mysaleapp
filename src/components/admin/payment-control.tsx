"use client"

import { BanIcon, CheckIcon, Loader2Icon, PencilIcon, RotateCcwIcon, SmartphoneIcon, WalletIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, TextAreaField, TextField } from "@/components/form"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateOrderPayment } from "@/features/orders/admin-actions"
import { splitCancelReason } from "@/features/orders/reasons"
import { buildUpiUrl } from "@/features/orders/upi"
import {
  PAYMENT_GATEWAY_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  canVerifyPayment,
  type Cancellation,
  type OrderPayment,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/orders/types"
import { paymentDue } from "@/features/orders/payment-due"
import { allowedPaymentStatuses, isPaymentMoneyLocked, paymentEditNote } from "@/features/orders/payment-rules"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-orders.module.css"

type PaymentOrder = OrderPayment & {
  id: string
  orderCode: string
  customerName: string
  phone: string
  total: number
  status: OrderStatus
  cancellation?: Cancellation | null
}

type PaymentValues = {
  status: PaymentStatus
  method: string
  otherMethod: string
  reference: string
  amount: string
  note: string
}

function splitOtherPaymentNote(method: string | null | undefined, rawNote: string | null | undefined): { otherMethod: string; note: string } {
  const text = (rawNote ?? "").trim()
  if (method !== "other" || !text) return { otherMethod: "", note: text }
  const match = /^Paid via:\s*(.+?)(?:\s+—\s+([\s\S]*))?$/i.exec(text)
  if (match) {
    return { otherMethod: match[1].trim(), note: (match[2] ?? "").trim() }
  }
  return { otherMethod: text, note: "" }
}

function combineOtherPaymentNote(method: string, otherMethod: string, note: string): string {
  const cleanNote = note.trim()
  if (method !== "other") return cleanNote
  const cleanOther = otherMethod.trim()
  if (!cleanOther) return cleanNote
  return cleanNote ? `Paid via: ${cleanOther} — ${cleanNote}` : `Paid via: ${cleanOther}`
}

const statusOptions = PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))
const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>{children}</dd>
    </div>
  )
}

/**
 * Payment card for the admin: what the customer paid, one-click verify / reject, and a
 * collapsible manual record. "Verify" marks it paid AND confirms the order.
 * The page gives this component a `key` that changes with the order, so it always shows fresh data.
 */
export function PaymentControl({ order }: { order: PaymentOrder }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [reasonTouched, setReasonTouched] = useState(false)
  // Which action is waiting for "are you sure?" (verify / reject / refund change money records).
  const [refundValues, setRefundValues] = useState<Omit<PaymentValues, "otherMethod"> | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [ask, setAsk] = useState<"verify" | "reject" | null>(null)

  // Paid and the order is closed: the amount / UTR / method are locked and the only thing left is a refund,
  // so the manual form turns into a small "Refund this payment" form (nothing to edit is shown).
  const refundOnly = isPaymentMoneyLocked(order) && order.paymentStatus === "paid"
  const remainingToRefund = Math.max(0, Math.round(((order.paymentAmount ?? order.total) - Number(order.refundedAmount ?? 0)) * 100) / 100)
  const initialNoteParts = splitOtherPaymentNote(order.paymentMethod, order.paymentNote)
  const defaultFormValues: PaymentValues = {
    status: refundOnly ? "refunded" : order.paymentStatus,
    method: order.paymentMethod ?? "",
    otherMethod: refundOnly ? "" : initialNoteParts.otherMethod,
    reference: refundOnly ? "" : (order.paymentReference ?? ""),
    amount: refundOnly ? "" : order.paymentAmount == null ? "" : String(order.paymentAmount),
    note: refundOnly ? "" : initialNoteParts.note,
  }
  const form = useForm<PaymentValues>({
    defaultValues: defaultFormValues,
  })
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setRefundOpen(nextOpen)
    if (!nextOpen) {
      form.reset(defaultFormValues)
      form.clearErrors()
    }
  }
  const { errors } = form.formState
  const [statusNow, methodNow, otherMethodNow, referenceNow, amountNow, noteNow] = useWatch({
    control: form.control,
    name: ["status", "method", "otherMethod", "reference", "amount", "note"],
  })

  const isRefunding = refundOnly || statusNow === "refunded"
  const otherTrimmed = (otherMethodNow ?? "").trim()
  const refTrimmed = (referenceNow ?? "").trim()
  const amtTrimmed = (amountNow ?? "").trim()
  const noteTrimmed = (noteNow ?? "").trim()
  const combinedNoteNow = isRefunding ? noteTrimmed : combineOtherPaymentNote(methodNow ?? "", otherTrimmed, noteTrimmed)

  const hasPaymentChanges =
    statusNow !== order.paymentStatus ||
    (methodNow ?? "") !== (order.paymentMethod ?? "") ||
    refTrimmed !== (order.paymentReference ?? "").trim() ||
    amtTrimmed !== (order.paymentAmount == null ? "" : String(order.paymentAmount)) ||
    combinedNoteNow !== (order.paymentNote ?? "").trim()

  const canSubmitDialog = isRefunding ? true : hasPaymentChanges

  const run = (values: Omit<PaymentValues, "otherMethod">, after: (confirmed: boolean) => void, onFail?: () => void) =>
    startTransition(async () => {
      // expectedRefunded: what this screen showed, so a double click / stale tab can't refund twice
      const res = await updateOrderPayment({ orderId: order.id, expectedRefunded: Number(order.refundedAmount ?? 0), ...values })
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof PaymentValues, { message: messages[0] })
        }
        onFail?.()
        return
      }
      after(res.data.confirmed)
      router.refresh()
    })

  const verify = () =>
    run(
      {
        status: "paid",
        method: order.paymentMethod ?? "upi",
        reference: order.paymentReference ?? "",
        amount: String(order.total),
        note: "",
      },
      (confirmed) => {
        setAsk(null)
        setRejecting(false)
        later(() => toast.success(confirmed ? "Payment verified. Order confirmed." : "Payment marked as paid"))
      }
    )

  const reject = () => {
    const trimmedReason = reason.trim()
    if (trimmedReason.length < 5) {
      toast.error("Please enter a reason (at least 5 characters) for rejecting the payment.")
      return
    }
    run(
      { status: "failed", method: order.paymentMethod ?? "upi", reference: order.paymentReference ?? "", amount: "", note: trimmedReason },
      () => {
        setAsk(null)
        setRejecting(false)
        setReason("")
        setReasonTouched(false)
        later(() => toast.success("Payment rejected. The customer can submit it again."))
      }
    )
  }

  const onSave = form.handleSubmit((values) => {
    form.clearErrors()
    const cleanOther = values.otherMethod.trim()
    const cleanRef = refundOnly || values.status === "refunded" ? values.reference.trim().toUpperCase() : values.reference.trim()
    const cleanAmt = values.amount.trim()
    const numAmt = Number(cleanAmt)
    const cleanNote = values.note.trim()

    if (refundOnly || values.status === "refunded") {
      let hasErr = false
      if (cleanRef.length < LIMITS.utr.min) {
        form.setError("reference", { message: `Enter the refund UTR / reference (${LIMITS.utr.min}–${LIMITS.utr.max} characters)` })
        hasErr = true
      } else if (cleanRef.toUpperCase() === (order.paymentReference ?? "").trim().toUpperCase()) {
        form.setError("reference", { message: "Enter your refund UTR, not the customer's incoming payment UTR" })
        hasErr = true
      }
      if (!cleanAmt || !Number.isFinite(numAmt) || numAmt <= 0) {
        form.setError("amount", { message: "Enter the refund amount" })
        hasErr = true
      } else if (numAmt > remainingToRefund + 0.005) {
        form.setError("amount", { message: `At most ₹${remainingToRefund.toFixed(2)}` })
        hasErr = true
      }
      if (cleanNote.length < 3) {
        form.setError("note", { message: "Enter a refund note / reason (at least 3 characters)" })
        hasErr = true
      }
      if (hasErr) return
      setRefundOpen(false)
      setRefundValues({ status: values.status, method: values.method, reference: cleanRef, amount: cleanAmt, note: cleanNote })
      return
    }

    if (values.method === "other" && cleanOther.length < 2) {
      form.setError("otherMethod", { message: "Specify how the customer paid (at least 2 characters)" })
      return
    }

    if (values.status === "paid") {
      let hasErr = false
      if (!values.method) {
        form.setError("method", { message: "Select how the customer paid" })
        hasErr = true
      }
      if ((values.method === "upi" || values.method === "bank_transfer") && cleanRef.length < LIMITS.utr.min) {
        form.setError("reference", { message: "Enter the UTR / reference number" })
        hasErr = true
      }
      if (!cleanAmt || !Number.isFinite(numAmt) || numAmt <= 0) {
        form.setError("amount", { message: "Enter the amount received" })
        hasErr = true
      }
      if (hasErr) return
    } else if (values.status === "failed" && cleanNote.length < 5) {
      form.setError("note", { message: "Enter the reason for rejecting (at least 5 characters)" })
      return
    } else if (values.status === "submitted" && cleanRef.length < LIMITS.utr.min) {
      form.setError("reference", { message: "Enter the UTR / reference number" })
      return
    }

    const finalNote = combineOtherPaymentNote(values.method, cleanOther, cleanNote)
    run({ status: values.status, method: values.method, reference: cleanRef, amount: cleanAmt, note: finalNote }, (confirmed) => {
      later(() => {
        setRefundOpen(false)
        toast.success(confirmed ? "Payment saved. Order confirmed." : "Payment record saved")
      })
    })
  })

  const needsVerification = order.paymentStatus === "submitted"
  const canVerify = canVerifyPayment(order)
  const due = paymentDue(order)
  // Only offer payment states this order may move to (a paid order can't go back to unpaid; see payment-rules.ts)
  const allowed = allowedPaymentStatuses(order)
  const allowedOptions = statusOptions.filter((o) => allowed.includes(o.value))
  const editNote = paymentEditNote(order)
  // On a closed order a cash refund only makes sense when money is owed back: a CANCELLED order that was paid.
  // A delivered order is refunded through its return ("Refund the returned items" in the status dropdown), not here.
  const owedBack = remainingToRefund > 0.005
  const showManual = order.paymentStatus !== "refunded" && !refundOnly
  const lockPaidFields = isPaymentMoneyLocked(order) && order.paymentStatus === "paid" && statusNow === "paid"
  const { refundUpiId: cancelRefundUpiId } = splitCancelReason(order.cancellation?.reason)
  const refundUpiDeepLink =
    cancelRefundUpiId && remainingToRefund > 0
      ? buildUpiUrl({
          upiId: cancelRefundUpiId,
          payeeName: order.customerName,
          amount: remainingToRefund,
          orderCode: `${order.orderCode} Refund`,
        })
      : null

  return (
    <div className={styles.paymentRoot}>
      <div className={styles.paymentHeader}>
        <h2 className={styles.paymentHeading}>Payment</h2>
        <PaymentBadge status={order.paymentStatus} orderStatus={order.status} method={order.paymentMethod} refundedAmount={order.refundedAmount} paidAmount={order.paymentAmount ?? order.total} />
      </div>

      <dl className={styles.factsGrid}>
        {due && <Fact label={due.label}>{formatPrice(due.amount)}</Fact>}
        <Fact label="Received">{order.paymentAmount == null ? "—" : formatPrice(order.paymentAmount)}</Fact>
        <Fact label="Method">{order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : "—"}</Fact>
        {order.paymentGateway && <Fact label="Gateway">{PAYMENT_GATEWAY_LABEL[order.paymentGateway]}</Fact>}
        {order.gatewayOrderId && (
          <Fact label="Gateway Order ID">
            <CopyableReference value={order.gatewayOrderId} />
          </Fact>
        )}
        <Fact label="UTR / reference">
          {order.paymentReference ? <CopyableReference value={order.paymentReference} /> : "—"}
        </Fact>
        {order.paymentSubmittedAt && <Fact label="Customer submitted">{formatDateTime(order.paymentSubmittedAt)}</Fact>}
        {order.paymentPaidAt && <Fact label="Marked paid">{formatDateTime(order.paymentPaidAt)}</Fact>}
      </dl>

      {order.status === "cancelled" && order.paymentStatus === "paid" && owedBack && (
        <div className={styles.owedRefundBox}>
          <p>
            <span className={styles.boldSpan}>This order was cancelled after the customer paid.</span> Send{" "}
            {formatPrice(remainingToRefund)} back to them, then record the refund details.
          </p>
          <div className={styles.refundHelperCard}>
            <p className={styles.refundHelperTitle}>
              <WalletIcon className={styles.iconSm} aria-hidden /> How to send {formatPrice(remainingToRefund)} to the original source:
            </p>
            {cancelRefundUpiId ? (
              <div className={styles.refundUpiHighlight}>
                <div>
                  <span className={styles.mutedSpan}>Customer&apos;s Refund UPI ID: </span>
                  <CopyableReference value={cancelRefundUpiId} />
                </div>
                {refundUpiDeepLink && (
                  <a href={refundUpiDeepLink} className={buttonVariants({ variant: "primary", size: "xs" })}>
                    <SmartphoneIcon className={styles.iconSm} aria-hidden /> Pay {formatPrice(remainingToRefund)} via UPI App
                  </a>
                )}
              </div>
            ) : null}
            <p className={styles.refundHelperStep}>
              {order.paymentReference ? (
                <>
                  <strong>Original UTR lookup:</strong> Search UTR <CopyableReference value={order.paymentReference} /> in your Bank / Merchant UPI app, open the incoming transaction, and tap <strong>Refund / Pay to sender</strong>.
                </>
              ) : (
                "Check the incoming payment in your UPI/bank statement and send the refund back to the sender account."
              )}
            </p>
          </div>
          <Button

            type="button"
            variant="outline"
            disabled={pending}
            className={styles.pillBtn}
            onClick={() => setRefundOpen(true)}
          >
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <RotateCcwIcon className={styles.iconMd} />} Mark as refunded
          </Button>
        </div>
      )}

      {needsVerification && (
        <p className={styles.verifyNoteBox}>
          <span className={styles.boldSpan}>
            {order.status === "cancelled" ? "This order was cancelled after the customer submitted a payment." : "The customer says they paid."}
          </span>{" "}
          Look for {formatPrice(order.total)} with this reference in your UPI/bank app, then{" "}
          {order.status === "cancelled" ? "mark it received (so you can refund it) or reject it." : "verify."}
        </p>
      )}

      {canVerify && (
        <div className={styles.verifyActionRow}>
          <Button type="button" variant="success" onClick={() => setAsk("verify")} disabled={pending} className={styles.verifyPrimaryBtn}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <CheckIcon className={styles.iconMd} />}{" "}
            {order.status === "cancelled" ? "Payment received (mark paid)" : "Verify payment & confirm order"}
          </Button>
          {needsVerification && !rejecting && (
            <Button
              type="button"
              variant="destructiveOutline"
              onClick={() => {
                setRejecting(true)
                requestAnimationFrame(() => {
                  document.querySelector<HTMLElement>("[placeholder*='UTR']")?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                })
              }}
              className={styles.rejectTriggerBtn}
            >
              <BanIcon className={styles.iconMd} /> Reject
            </Button>
          )}
        </div>
      )}

      {rejecting && (
        <div className={styles.rejectBox}>
          <TextAreaField
            label="Reason (shown to the customer)"
            required
            maxLength={LIMITS.paymentNote.max}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setReasonTouched(true)}
            placeholder="e.g. We couldn't find this UTR. Please check and resend."
            error={reasonTouched && reason.trim().length < 5 ? "Please write at least 5 characters" : undefined}
          />
          <div className={styles.rejectBtnRow}>
            <Button type="button" variant="destructive" onClick={() => setAsk("reject")} disabled={pending || reason.trim().length < 5} className={styles.rejectConfirmBtn}>
              {pending ? <Loader2Icon className={styles.spinIcon} /> : <BanIcon className={styles.iconMd} />} Reject payment
            </Button>
            <Button type="button" variant="outline" onClick={() => { setRejecting(false); setReason(""); setReasonTouched(false) }} className={styles.rejectCancelBtn}>
              <XIcon className={styles.iconMd} /> Cancel
            </Button>
          </div>
        </div>
      )}

      {/* A refunded payment is final: nothing left to edit. For a cancelled paid order, the orange "Mark as refunded" button above opens this dialog. */}
      {(showManual || (refundOnly && order.status === "cancelled" && owedBack)) && (
        <>
          {showManual && (
            <Button type="button" variant="outline" fullWidth onClick={() => setRefundOpen(true)}>
              <PencilIcon className={styles.iconMd} /> Edit payment record manually
            </Button>
          )}
          <Dialog open={refundOpen} onOpenChange={handleDialogOpenChange}>
            <DialogContent className={styles.dialogSmMax}>
              <form onSubmit={onSave} noValidate className={styles.dialogForm}>
                <DialogHeader showCloseButton={!pending}>
                  <DialogTitle>{refundOnly ? "Refund this payment" : "Edit payment record"}</DialogTitle>
                  <DialogDescription>
                    {refundOnly
                      ? `Send the money back first, then enter the refund reference, amount (up to ${formatPrice(remainingToRefund)}), and note.`
                      : "Fix the payment details by hand. Use this only when the verify button doesn't fit."}
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className={styles.dialogBodyStack2}>
                  {editNote && !refundOnly && order.paymentStatus !== "paid" && (
                    <p role="note" className={styles.editPaymentNote}>
                      {editNote}
                    </p>
                  )}
                  {!refundOnly && allowedOptions.length > 1 && <FormSelectField control={form.control} name="status" label="Payment status" fieldSize="md" options={allowedOptions} />}
                  {!refundOnly && <FormSelectField control={form.control} name="method" label="Paid how?" fieldSize="md" placeholder="Select method" options={methodOptions} />}
                  {!refundOnly && methodNow === "other" && (
                    <TextField
                      label="Specify payment method"
                      required
                      fieldSize="md"
                      maxLength={60}
                      placeholder="e.g. Gift voucher, Cheque, Wallet…"
                      error={errors.otherMethod?.message}
                      {...form.register("otherMethod")}
                    />
                  )}
                  <TextField
                    label={isRefunding ? "Refund UTR / reference" : "UTR / reference"}
                    required={isRefunding || statusNow === "submitted" || (statusNow === "paid" && (methodNow === "upi" || methodNow === "bank_transfer"))}
                    fieldSize="md"
                    kind={order.paymentGateway || isRefunding ? "gatewayRef" : "paymentRef"}
                    autoCapitalize={isRefunding ? "characters" : undefined}
                    placeholder={isRefunding ? "e.g. 412345678901" : undefined}
                    disabled={lockPaidFields && !refundOnly}
                    className={cn(styles.monoText, isRefunding && styles.uppercaseInput)}
                    error={errors.reference?.message}
                    {...form.register("reference", {
                      onChange: (e) => {
                        if (!isRefunding) return
                        const el = e.target as HTMLInputElement
                        const upper = el.value.toUpperCase()
                        if (upper !== el.value) {
                          const start = el.selectionStart
                          const end = el.selectionEnd
                          el.value = upper
                          if (start != null && end != null) el.setSelectionRange(start, end)
                        }
                      },
                    })}
                  />
                  {isRefunding && remainingToRefund > 0 ? (
                    <div className={styles.refundAmountRow}>
                      <TextField
                        containerClassName={styles.refundAmountField}
                        label="Amount to refund"
                        required
                        kind="money"
                        maxLength={String(LIMITS.paymentAmount.max).length + 3}
                        fieldSize="md"
                        inputMode="decimal"
                        leading="₹"
                        placeholder={String(remainingToRefund)}
                        disabled={lockPaidFields && !refundOnly}
                        hint={`Max refundable: ${formatPrice(remainingToRefund)}. Enter a smaller amount for a partial refund.`}
                        error={errors.amount?.message}
                        {...form.register("amount")}
                      />
                      <button
                        type="button"
                        disabled={pending || (lockPaidFields && !refundOnly)}
                        aria-pressed={amtTrimmed !== "" && Math.abs(Number(amtTrimmed) - remainingToRefund) < 0.005}
                        onClick={() => {
                          form.setValue("amount", String(remainingToRefund), { shouldDirty: true, shouldValidate: true })
                          form.clearErrors("amount")
                        }}
                        className={cn(
                          styles.fullRefundBtn,
                          amtTrimmed !== "" && Math.abs(Number(amtTrimmed) - remainingToRefund) < 0.005 && styles.fullRefundBtnSelected
                        )}
                      >
                        {amtTrimmed !== "" && Math.abs(Number(amtTrimmed) - remainingToRefund) < 0.005 && (
                          <CheckIcon className={styles.iconSm} aria-hidden />
                        )}
                        Full ({formatPrice(remainingToRefund)})
                      </button>
                    </div>
                  ) : (
                    <TextField
                      label={isRefunding ? "Amount to refund" : "Amount received"}
                      required={isRefunding || statusNow === "paid"}
                      kind="money"
                      maxLength={String(LIMITS.paymentAmount.max).length + 3}
                      fieldSize="md"
                      inputMode="decimal"
                      leading="₹"
                      placeholder={isRefunding ? String(remainingToRefund) : String(order.total)}
                      disabled={lockPaidFields && !refundOnly}
                      hint={
                        isRefunding
                          ? `Max refundable: ${formatPrice(remainingToRefund)}. Enter a smaller amount for a partial refund.`
                          : `Order total is ${formatPrice(order.total)}.`
                      }
                      error={errors.amount?.message}
                      {...form.register("amount")}
                    />
                  )}
                  <TextAreaField
                    label={isRefunding ? "Refund reason / note (visible to the customer)" : statusNow === "failed" ? "Reason for rejection (visible to the customer)" : "Note (visible to the customer)"}
                    required={isRefunding || statusNow === "failed"}
                    maxLength={LIMITS.paymentNote.max}
                    rows={2}
                    placeholder={isRefunding ? "e.g. Refunded to original UPI ID after cancellation" : statusNow === "failed" ? "e.g. UTR not found in bank statement" : undefined}
                    error={errors.note?.message}
                    {...form.register("note")}
                  />
                </DialogBody>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)} disabled={pending} className={styles.pillBtnGap}>
                    <XIcon className={styles.iconMd} /> Cancel
                  </Button>
                  <Button type="submit" disabled={!canSubmitDialog || pending} className={styles.pillBtnGap}>
                    {pending ? <Loader2Icon className={styles.spinIcon} /> : refundOnly ? <RotateCcwIcon className={styles.iconMd} /> : <CheckIcon className={styles.iconMd} />} {refundOnly ? "Refund payment" : "Save payment record"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
      <ConfirmDialog
        open={refundValues !== null}
        onOpenChange={(o) => !o && !pending && setRefundValues(null)}
        destructive
        title="Refund this payment?"
        description="Only do this after you have sent the money back to the customer. A refund can't be undone."
        confirmLabel="Yes, mark refunded"
        pending={pending}
        onConfirm={() =>
          refundValues &&
          run(
            refundValues,
            () => {
              later(() => {
                setRefundValues(null)
                toast.success("Refund recorded")
              })
            },
            () => {
              setRefundValues(null)
              setRefundOpen(true)
            }
          )
        }
      />
      <ConfirmDialog
        open={ask !== null}
        onOpenChange={(o) => !o && !pending && setAsk(null)}
        destructive={ask === "reject"}
        title={ask === "verify" ? "Verify this payment?" : "Reject this payment?"}
        description={
          ask === "verify"
            ? order.status === "cancelled"
              ? `Mark ${formatPrice(order.total)} as received on this cancelled order so you can record the refund. Only do this after you see the money in your UPI/bank app.`
              : `Mark ${formatPrice(order.total)} as received and confirm the order. Only do this after you see the money in your UPI/bank app.`
            : "The customer is told the payment was not found and can submit it again."
        }
        confirmLabel={ask === "verify" ? "Yes, verify" : "Yes, reject"}
        pending={pending}
        onConfirm={() => {
          const which = ask
          if (which === "verify") verify()
          else if (which === "reject") reject()
        }}
      />
    </div>
  )
}

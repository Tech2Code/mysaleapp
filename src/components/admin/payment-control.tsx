"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, TextAreaField, TextField } from "@/components/form"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateOrderPayment } from "@/features/orders/admin-actions"
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHODS,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  canVerifyPayment,
  type OrderPayment,
  type OrderStatus,
  type PaymentStatus,
} from "@/features/orders/types"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { paymentDue } from "@/features/orders/payment-due"
import { allowedPaymentStatuses, isPaymentMoneyLocked, paymentEditNote } from "@/features/orders/payment-rules"
import { buildPaymentMessage, whatsappLink } from "@/features/orders/whatsapp"
import { formatDateTime, formatPrice } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

type PaymentOrder = OrderPayment & {
  id: string
  orderCode: string
  customerName: string
  phone: string
  total: number
  status: OrderStatus
}

type PaymentValues = {
  status: PaymentStatus
  method: string
  reference: string
  amount: string
  note: string
}

const statusOptions = PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))
const methodOptions = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-ui="admin/Fact">
      <dt data-ui="admin/Fact/dt" className="text-xs text-muted-foreground">{label}</dt>
      <dd data-ui="admin/Fact/dd" className="mt-0.5 text-sm font-medium">{children}</dd>
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
  const shop = useStoreSettings()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  // Which action is waiting for "are you sure?" (verify / reject / refund change money records).
  const [refundValues, setRefundValues] = useState<PaymentValues | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [ask, setAsk] = useState<"verify" | "reject" | "refund" | null>(null)

  // Paid and the order is closed: the amount / UTR / method are locked and the only thing left is a refund,
  // so the manual form turns into a small "Refund this payment" form (nothing to edit is shown).
  const refundOnly = isPaymentMoneyLocked(order) && order.paymentStatus === "paid"
  const form = useForm<PaymentValues>({
    defaultValues: {
      status: refundOnly ? "refunded" : order.paymentStatus,
      method: order.paymentMethod ?? "",
      reference: refundOnly ? "" : (order.paymentReference ?? ""),
      amount: refundOnly || order.paymentAmount == null ? "" : String(order.paymentAmount),
      note: refundOnly ? "" : (order.paymentNote ?? ""),
    },
  })
  const { errors, isDirty } = form.formState
  const statusNow = useWatch({ control: form.control, name: "status" })

  const notifyUrl = (result: "paid" | "failed", amount?: number | null, why?: string | null) =>
    whatsappLink(
      `91${order.phone}`,
      buildPaymentMessage(shop, { orderCode: order.orderCode, customerName: order.customerName, result, amount, reason: why })
    )

  const run = (values: PaymentValues, after: (confirmed: boolean) => void) =>
    startTransition(async () => {
      // expectedRefunded: what this screen showed, so a double click / stale tab can't refund twice
      const res = await updateOrderPayment({ orderId: order.id, expectedRefunded: Number(order.refundedAmount ?? 0), ...values })
      if (!res.ok) {
        toast.error(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof PaymentValues, { message: messages[0] })
        }
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
        setRejecting(false)
        later(() => toast.success(confirmed ? "Payment verified. Order confirmed." : "Payment marked as paid", {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl("paid", order.total), "_blank", "noopener") },
        }))
      }
    )

  const reject = () =>
    run(
      { status: "failed", method: order.paymentMethod ?? "upi", reference: order.paymentReference ?? "", amount: "", note: reason },
      () => {
        setRejecting(false)
        later(() => toast.success("Payment rejected. The customer can submit it again.", {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl("failed", null, reason || null), "_blank", "noopener") },
        }))
      }
    )

  const refund = () =>
    run(
      {
        status: "refunded",
        method: order.paymentMethod ?? "",
        reference: "",
        amount: "", // blank = refund everything still owed (works after a partial refund too)
        note: "Refund sent",
      },
      () => later(() => toast.success("Marked as refunded"))
    )

  const onSave = form.handleSubmit((values) =>
    refundOnly || values.status === "refunded"
      ? (setRefundOpen(false), setRefundValues(values)) // a refund moves money: ask first
      : run(values, (confirmed) => { setRefundOpen(false); later(() => toast.success(confirmed ? "Payment saved. Order confirmed." : "Payment record saved")) })
  )

  const needsVerification = order.paymentStatus === "submitted"
  const canVerify = canVerifyPayment(order)
  const due = paymentDue(order)
  // Only offer payment states this order may move to (a paid order can't go back to unpaid; see payment-rules.ts)
  const allowed = allowedPaymentStatuses(order)
  const allowedOptions = statusOptions.filter((o) => allowed.includes(o.value))
  const editNote = paymentEditNote(order)
  // On a closed order a cash refund only makes sense when money is owed back: a CANCELLED order that was paid.
  // A delivered order is refunded through its return ("Refund the returned items" in the status dropdown), not here.
  const owedBack = (order.paymentAmount ?? order.total) - Number(order.refundedAmount ?? 0) > 0.005
  const showManual = order.paymentStatus !== "refunded" && (!refundOnly || (order.status === "cancelled" && owedBack))
  const lockPaidFields = isPaymentMoneyLocked(order) && order.paymentStatus === "paid" && statusNow === "paid"

  return (
    <div data-ui="admin/PaymentControl" className="space-y-5">
      <div data-ui="admin/PaymentControl/div-flex" className="flex flex-wrap items-center justify-between gap-2">
        <h2 data-ui="admin/PaymentControl/h2-payment" className="font-sans text-lg font-semibold">Payment</h2>
        <PaymentBadge status={order.paymentStatus} orderStatus={order.status} method={order.paymentMethod} refundedAmount={order.refundedAmount} paidAmount={order.paymentAmount ?? order.total} />
      </div>

      <dl data-ui="admin/PaymentControl/dl-grid" className="grid gap-x-6 gap-y-3 grid-cols-2">
        {due && <Fact label={due.label}>{formatPrice(due.amount)}</Fact>}
        <Fact label="Received">{order.paymentAmount == null ? "—" : formatPrice(order.paymentAmount)}</Fact>
        <Fact label="Method">{order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : "—"}</Fact>
        <Fact label="UTR / reference">
          {order.paymentReference ? <CopyableReference value={order.paymentReference} /> : "—"}
        </Fact>
        {order.paymentSubmittedAt && <Fact label="Customer submitted">{formatDateTime(order.paymentSubmittedAt)}</Fact>}
        {order.paymentPaidAt && <Fact label="Marked paid">{formatDateTime(order.paymentPaidAt)}</Fact>}
      </dl>

      {order.status === "cancelled" && order.paymentStatus === "paid" && (
        <div data-ui="admin/PaymentControl/div" className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4 text-sm dark:border-orange-900/50 dark:bg-orange-950/20">
          <p data-ui="admin/PaymentControl/p">
            <span data-ui="admin/PaymentControl/span" className="font-semibold">This order was cancelled after the customer paid.</span> Send{" "}
            {formatPrice(order.paymentAmount ?? order.total)} back to them, then mark it refunded.
          </p>
          <Button data-ui="admin/PaymentControl/Button-mark-as-refunded"
            type="button"
            variant="outline"
            disabled={pending}
            className="rounded-full"
            onClick={() => setAsk("refund")}
          >
            {pending && <Loader2Icon className="animate-spin" />} Mark as refunded
          </Button>
        </div>
      )}

      {needsVerification && order.status !== "cancelled" && (
        <p data-ui="admin/PaymentControl/p-2" className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <span data-ui="admin/PaymentControl/span-2" className="font-semibold">The customer says they paid.</span> Look for {formatPrice(order.total)} with this
          reference in your UPI/bank app, then verify.
        </p>
      )}

      {canVerify && (
        <div data-ui="admin/PaymentControl/div-flex-2" className="flex flex-wrap items-start gap-2">
          <Button data-ui="admin/PaymentControl/Button-verify-payment-confirm" type="button" onClick={() => setAsk("verify")} disabled={pending} className="rounded-full bg-success-solid text-white hover:bg-success-solid/90">
            {pending && <Loader2Icon className="animate-spin" />} Verify payment & confirm order
          </Button>
          {needsVerification && !rejecting && (
            <Button data-ui="admin/PaymentControl/Button-reject" type="button" variant="outline" onClick={() => setRejecting(true)} className="rounded-full">
              Reject…
            </Button>
          )}
        </div>
      )}

      {rejecting && (
        <div data-ui="admin/PaymentControl/div-2" className="space-y-1 rounded-xl border p-4">
          <TextAreaField
            label="Reason (shown to the customer)" maxLength={LIMITS.paymentNote.max}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. We couldn't find this UTR. Please check and resend."
          />
          <div data-ui="admin/PaymentControl/div-flex-3" className="flex gap-2">
            <Button data-ui="admin/PaymentControl/Button-reject-payment" type="button" variant="destructive" onClick={() => setAsk("reject")} disabled={pending} className="rounded-full">
              Reject payment
            </Button>
            <Button data-ui="admin/PaymentControl/Button-cancel" type="button" variant="ghost" onClick={() => setRejecting(false)} className="rounded-full">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* A refunded payment is final: nothing left to edit, so no form is offered. Refund / edit both open in a dialog. */}
      {showManual && (
        <>
          <Button data-ui="admin/PaymentControl/Button" type="button" variant="outline" onClick={() => setRefundOpen(true)} className="w-full rounded-full sm:w-auto">
            {refundOnly ? "Refund this payment" : "Edit payment record manually"}
          </Button>
          <Dialog open={refundOpen} onOpenChange={(o) => !pending && setRefundOpen(o)}>
            <DialogContent data-ui="admin/PaymentControl/DialogContent" className="max-h-[90dvh] gap-5 overflow-y-auto p-5 sm:max-w-md sm:p-6">
              <DialogHeader>
                <DialogTitle>{refundOnly ? "Refund this payment" : "Edit payment record"}</DialogTitle>
                <DialogDescription>
                  {refundOnly
                    ? "Send the money back first, then record it here. Blank amount = refund everything still owed."
                    : "Fix the payment details by hand. Use this only when the verify button doesn't fit."}
                </DialogDescription>
              </DialogHeader>
              <form data-ui="admin/PaymentControl/form-grid" onSubmit={onSave} noValidate className="grid gap-y-1">
                {editNote && !refundOnly && (
                  <p data-ui="admin/PaymentControl/p-3" role="note" className="mb-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {editNote}
                  </p>
                )}
                {!refundOnly && <FormSelectField control={form.control} name="status" label="Payment status" fieldSize="md" options={allowedOptions} />}
                {!refundOnly && <FormSelectField control={form.control} name="method" label="Paid how?" fieldSize="md" placeholder="Not set" options={methodOptions} />}
                <TextField
                  label={refundOnly ? "Refund reference (optional)" : "UTR / reference"}
                  fieldSize="md"
                  kind="paymentRef"
                  disabled={lockPaidFields && !refundOnly}
                  className="font-mono"
                  error={errors.reference?.message}
                  {...form.register("reference")}
                />
                <TextField
                  label={statusNow === "refunded" ? "Amount to refund" : "Amount received"} kind="money"
                  maxLength={String(LIMITS.paymentAmount.max).length + 3}
                  fieldSize="md"
                  inputMode="decimal"
                  leading="₹"
                  disabled={lockPaidFields && !refundOnly}
                  hint={
                    statusNow === "refunded"
                      ? "Blank = refund everything still owed. A smaller amount records a partial refund."
                      : "Leave blank to use the order total when marking as paid."
                  }
                  error={errors.amount?.message}
                  {...form.register("amount")}
                />
                <TextAreaField
                  label="Note (visible to the customer)" maxLength={LIMITS.paymentNote.max}
                  rows={2}
                  error={errors.note?.message}
                  {...form.register("note")}
                />
                <div data-ui="admin/PaymentControl/div-flex-4" className="mt-2 flex flex-wrap justify-end gap-2">
                  <Button data-ui="admin/PaymentControl/Button-cancel-2" type="button" variant="ghost" onClick={() => setRefundOpen(false)} disabled={pending} className="rounded-full">
                    Cancel
                  </Button>
                  <Button data-ui="admin/PaymentControl/Button-2" type="submit" disabled={(!isDirty && !refundOnly) || pending} className="rounded-full">
                    {pending && <Loader2Icon className="animate-spin" />} {refundOnly ? "Refund payment" : "Save payment record"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
      <ConfirmDialog
        open={refundValues !== null}
        onOpenChange={(o) => !o && setRefundValues(null)}
        destructive
        title="Refund this payment?"
        description="Only do this after you have sent the money back to the customer. A refund can't be undone."
        confirmLabel="Yes, mark refunded"
        pending={pending}
        onConfirm={() => refundValues && run(refundValues, () => { setRefundValues(null); later(() => toast.success("Refund recorded")) })}
      />
      <ConfirmDialog
        open={ask !== null}
        onOpenChange={(o) => !o && setAsk(null)}
        destructive={ask === "reject"}
        title={ask === "verify" ? "Verify this payment?" : ask === "reject" ? "Reject this payment?" : "Mark as refunded?"}
        description={
          ask === "verify"
            ? `Mark ${formatPrice(order.total)} as received and confirm the order. Only do this after you see the money in your UPI/bank app.`
            : ask === "reject"
              ? "The customer is told the payment was not found and can submit it again."
              : `Only do this after you have sent ${formatPrice(order.paymentAmount ?? order.total)} back to the customer. It can't be undone.`
        }
        confirmLabel={ask === "verify" ? "Yes, verify" : ask === "reject" ? "Yes, reject" : "Yes, mark refunded"}
        onConfirm={() => {
          const which = ask
          setAsk(null)
          if (which === "verify") verify()
          else if (which === "reject") reject()
          else if (which === "refund") refund()
        }}
      />
    </div>
  )
}

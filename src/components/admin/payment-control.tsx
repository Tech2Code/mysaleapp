"use client"

import { ChevronDownIcon, Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, TextAreaField, TextField } from "@/components/form"
import { PaymentBadge } from "@/components/shared/payment-badge"
import { Button } from "@/components/ui/button"
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
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")

  const form = useForm<PaymentValues>({
    defaultValues: {
      status: order.paymentStatus,
      method: order.paymentMethod ?? "",
      reference: order.paymentReference ?? "",
      amount: order.paymentAmount == null ? "" : String(order.paymentAmount),
      note: order.paymentNote ?? "",
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
        toast.success(confirmed ? "Payment verified. Order confirmed." : "Payment marked as paid", {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl("paid", order.total), "_blank", "noopener") },
        })
      }
    )

  const reject = () =>
    run(
      { status: "failed", method: order.paymentMethod ?? "upi", reference: order.paymentReference ?? "", amount: "", note: reason },
      () => {
        setRejecting(false)
        toast.success("Payment rejected. The customer can submit it again.", {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl("failed", null, reason || null), "_blank", "noopener") },
        })
      }
    )

  const onSave = form.handleSubmit((values) =>
    run(values, (confirmed) => toast.success(confirmed ? "Payment saved. Order confirmed." : "Payment record saved"))
  )

  const needsVerification = order.paymentStatus === "submitted"
  const canVerify = canVerifyPayment(order)
  const due = paymentDue(order)
  // Only offer payment states this order may move to (a paid order can't go back to unpaid; see payment-rules.ts)
  const allowed = allowedPaymentStatuses(order)
  const allowedOptions = statusOptions.filter((o) => allowed.includes(o.value))
  const editNote = paymentEditNote(order)
  const lockPaidFields = isPaymentMoneyLocked(order) && order.paymentStatus === "paid" && statusNow === "paid"

  return (
    <div data-ui="admin/PaymentControl" className="space-y-5">
      <div data-ui="admin/PaymentControl/div-flex" className="flex flex-wrap items-center justify-between gap-2">
        <h2 data-ui="admin/PaymentControl/h2-payment" className="font-sans text-lg font-semibold">Payment</h2>
        <PaymentBadge status={order.paymentStatus} orderStatus={order.status} method={order.paymentMethod} refundedAmount={order.refundedAmount} paidAmount={order.paymentAmount ?? order.total} />
      </div>

      <dl data-ui="admin/PaymentControl/dl-grid" className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {due && <Fact label={due.label}>{formatPrice(due.amount)}</Fact>}
        <Fact label="Received">{order.paymentAmount == null ? "—" : formatPrice(order.paymentAmount)}</Fact>
        <Fact label="Method">{order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] : "—"}</Fact>
        <Fact label="UTR / reference">
          {order.paymentReference ? <span data-ui="admin/PaymentControl/span" className="font-mono">{order.paymentReference}</span> : "—"}
        </Fact>
        {order.paymentSubmittedAt && <Fact label="Customer submitted">{formatDateTime(order.paymentSubmittedAt)}</Fact>}
        {order.paymentPaidAt && <Fact label="Marked paid">{formatDateTime(order.paymentPaidAt)}</Fact>}
      </dl>

      {order.status === "cancelled" && order.paymentStatus === "paid" && (
        <div data-ui="admin/PaymentControl/div" className="space-y-3 rounded-xl border border-orange-200 bg-orange-50/70 p-4 text-sm dark:border-orange-900/50 dark:bg-orange-950/20">
          <p data-ui="admin/PaymentControl/p">
            <span data-ui="admin/PaymentControl/span-2" className="font-semibold">This order was cancelled after the customer paid.</span> Send{" "}
            {formatPrice(order.paymentAmount ?? order.total)} back to them, then mark it refunded.
          </p>
          <Button data-ui="admin/PaymentControl/Button-mark-as-refunded"
            type="button"
            variant="outline"
            disabled={pending}
            className="rounded-full"
            onClick={() =>
              run(
                {
                  status: "refunded",
                  method: order.paymentMethod ?? "",
                  reference: "",
                  amount: "", // blank = refund everything still owed (works after a partial refund too)
                  note: "Refund sent",
                },
                () => toast.success("Marked as refunded")
              )
            }
          >
            {pending && <Loader2Icon className="animate-spin" />} Mark as refunded
          </Button>
        </div>
      )}

      {needsVerification && order.status !== "cancelled" && (
        <p data-ui="admin/PaymentControl/p-2" className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-sm dark:border-sky-900/50 dark:bg-sky-950/20">
          <span data-ui="admin/PaymentControl/span-3" className="font-semibold">The customer says they paid.</span> Look for {formatPrice(order.total)} with this
          reference in your UPI/bank app, then verify.
        </p>
      )}

      {canVerify && (
        <div data-ui="admin/PaymentControl/div-flex-2" className="flex flex-wrap items-start gap-2">
          <Button data-ui="admin/PaymentControl/Button-verify-payment-confirm" type="button" onClick={verify} disabled={pending} className="rounded-full bg-success-solid text-white hover:bg-success-solid/90">
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
            <Button data-ui="admin/PaymentControl/Button-reject-payment" type="button" variant="destructive" onClick={reject} disabled={pending} className="rounded-full">
              Reject payment
            </Button>
            <Button data-ui="admin/PaymentControl/Button-cancel" type="button" variant="ghost" onClick={() => setRejecting(false)} className="rounded-full">
              Cancel
            </Button>
          </div>
        </div>
      )}

      <details data-ui="admin/PaymentControl/details" className="group rounded-xl border">
        <summary data-ui="admin/PaymentControl/summary-flex" className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted/50">
          Edit payment record manually
          <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <form data-ui="admin/PaymentControl/form-grid" onSubmit={onSave} noValidate className="grid gap-x-4 gap-y-1 border-t p-4 sm:grid-cols-2">
          {editNote && (
            <p data-ui="admin/PaymentControl/p-3" role="note" className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
              {editNote}
            </p>
          )}
          <FormSelectField control={form.control} name="status" label="Payment status" fieldSize="md" options={allowedOptions} />
          <FormSelectField control={form.control} name="method" label="Paid how?" fieldSize="md" placeholder="Not set" options={methodOptions} />
          <TextField
            label="UTR / reference"
            fieldSize="md"
            disabled={lockPaidFields}
            className="font-mono"
            error={errors.reference?.message}
            {...form.register("reference")}
          />
          <TextField
            label={statusNow === "refunded" ? "Amount to refund" : "Amount received"} kind="money"
            fieldSize="md"
            inputMode="decimal"
            leading="₹"
            disabled={lockPaidFields}
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
            containerClassName="sm:col-span-2"
            error={errors.note?.message}
            {...form.register("note")}
          />
          <div data-ui="admin/PaymentControl/div-3" className="sm:col-span-2">
            <Button data-ui="admin/PaymentControl/Button-save-payment-record" type="submit" variant="outline" disabled={!isDirty || pending} className="rounded-full">
              {pending && <Loader2Icon className="animate-spin" />} Save payment record
            </Button>
          </div>
        </form>
      </details>
    </div>
  )
}

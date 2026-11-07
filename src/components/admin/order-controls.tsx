"use client"

import { Loader2Icon, LockIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FormSelectField, SelectField, TextAreaField } from "@/components/form"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourierDialog, courierValues } from "./courier-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrderAsAdmin, updateAdminNote, updateOrderStatus } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, checkTransition, statusChoices } from "@/features/orders/transitions"
import { expectedDeliveryProblem, shippingSchema } from "@/features/orders/schema"
import { isOrderLocked, lockNote } from "@/features/orders/locking"
import type { ReturnStage } from "@/features/orders/returns"
import { STATUS_META, type OrderStatus, type PaymentStatus, type ShippingDetails } from "@/features/orders/types"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { buildStatusUpdateMessage, whatsappLink } from "@/features/orders/whatsapp"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

type Values = {
  status: OrderStatus
  carrier: string
  trackingNumber: string
  trackingUrl: string
  expectedDelivery: string
}

const SHIPPING_FIELDS = ["carrier", "trackingNumber", "trackingUrl", "expectedDelivery"] as const


export function OrderStatusControl({
  orderId,
  orderCode,
  customerName,
  phone,
  status,
  paymentStatus,
  shipping,
  returnStage = null,
  returnControl,
}: {
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  shipping: ShippingDetails | null
  /** A delivered order with a return in progress: the WhatsApp update talks about the return. */
  returnStage?: ReturnStage | null
  /** Delivered orders: the dropdown that manages the return steps (replaces the "locked" note). */
  returnControl?: ReactNode
}) {
  // Delivered / cancelled orders are frozen (features/orders/locking.ts; the server action and a DB trigger enforce it too).
  const locked = isOrderLocked(status)
  const note = lockNote(status)
  const announcedStage = status === "delivered" && returnStage?.badge ? returnStage : null
  // Only the current status and the legal next steps are offered (see features/orders/transitions.ts).
  const statusOptions = statusChoices(status).map((s) => ({ value: s, label: STATUS_META[s].label }))
  const router = useRouter()
  const shop = useStoreSettings()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  // The validated change waits here for "are you sure?" (a status change notifies the customer's order page).
  const [toConfirm, setToConfirm] = useState<{ values: Values; shipping: z.output<typeof shippingSchema> | undefined } | null>(null)

  const form = useForm<Values>({
    defaultValues: {
      status,
      carrier: shipping?.carrier ?? "",
      trackingNumber: shipping?.trackingNumber ?? "",
      trackingUrl: shipping?.trackingUrl ?? "",
      expectedDelivery: shipping?.expectedDelivery ?? "",
    },
  })
  const { isDirty } = form.formState
  const [value, carrier, trackingNumber, trackingUrl, expectedDelivery] = useWatch({
    control: form.control,
    name: ["status", ...SHIPPING_FIELDS],
  })

  // Shipping fields appear when marking an order "Shipped" (or when details already exist, so they can be edited).
  // Choosing "Shipped" asks for the courier details in a popup (CourierDialog). Once shipped, they are edited from the shipping card's Edit button.
  const showShipping = value === "shipped" && status !== "shipped"
  const [courierOpen, setCourierOpen] = useState(false)
  const hasAnyShipping = [carrier, trackingNumber, trackingUrl, expectedDelivery].some((v) => v?.trim())

  const notifyShipping: ShippingDetails | null = carrier?.trim()
    ? {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber?.trim() || null,
        trackingUrl: trackingUrl?.trim() || null,
        expectedDelivery: expectedDelivery || null,
      }
    : null
  const notifyUrl = whatsappLink(
    `91${phone}`,
    buildStatusUpdateMessage(shop, { orderCode, customerName, status: value, shipping: notifyShipping, returnStage: announcedStage })
  )

  const onSubmit = form.handleSubmit((values) => {
    // Same rule the server enforces: e.g. "Shipped" needs a courier. Show it next to the field.
    const problem = checkTransition({
      from: status,
      to: values.status,
      payment: paymentStatus,
      hasCourier: Boolean(values.carrier.trim()),
    })
    if (problem) {
      if (values.status === "shipped") setCourierOpen(true)
      toast.error(problem)
      return
    }

    let shippingPayload: z.output<typeof shippingSchema> | undefined

    if (showShipping && hasAnyShipping) {
      const dateProblem = expectedDeliveryProblem(values.expectedDelivery, shipping?.expectedDelivery)
      if (dateProblem) {
        form.setError("expectedDelivery", { message: dateProblem })
        return
      }
      const parsed = shippingSchema.safeParse({
        carrier: values.carrier,
        trackingNumber: values.trackingNumber,
        trackingUrl: values.trackingUrl,
        expectedDelivery: values.expectedDelivery,
      })
      if (!parsed.success) {
        for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
          if (messages?.[0]) form.setError(field as keyof Values, { message: messages[0] })
        }
        return
      }
      shippingPayload = parsed.data
    }

    setToConfirm({ values, shipping: shippingPayload })
  })

  const apply = ({ values, shipping: shippingPayload }: NonNullable<typeof toConfirm>) => {
    setToConfirm(null)
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: values.status, expectedStatus: status, shipping: shippingPayload })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => toast.success(`Status changed to ${STATUS_META[values.status].label}`, {
        action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl, "_blank", "noopener") },
      }))
      form.reset(values)
      router.refresh()
    })
  }

  return (
    <div data-ui="admin/OrderStatusControl" className="space-y-4">
    {/* Delivered: the status dropdown manages the return steps (outside the form: it has its own dialogs). */}
    {status === "delivered" && returnControl}
    <form data-ui="admin/OrderStatusControl/form" onSubmit={onSubmit} noValidate className="space-y-4">
      {locked ? (
        <div data-ui="admin/OrderStatusControl/div" className="space-y-3">
          {!(status === "delivered" && returnControl) && (
            <p data-ui="admin/OrderStatusControl/p-flex" role="note" className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm font-medium">
              <LockIcon className="size-4 shrink-0" aria-hidden /> {note}
            </p>
          )}
          {/* Courier details are not repeated here: the progress timeline shows them under "Shipped". */}
          <p data-ui="admin/OrderStatusControl/p" className="text-xs text-muted-foreground">
            Delivered order details stay locked. You can still add a private note and manage the return from the status above.
          </p>
        </div>
      ) : (
        <FormSelectField control={form.control} name="status" label="Order status" fieldSize="md" options={statusOptions} />
      )}

      {!locked && showShipping && (
        <div data-ui="admin/OrderStatusControl/div-flex" className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 text-sm dark:border-violet-900/50 dark:bg-violet-950/20">
          <p data-ui="admin/OrderStatusControl/p-2" className="min-w-0 wrap-anywhere">
            {carrier?.trim() ? (
              <>
                <span data-ui="admin/OrderStatusControl/span" className="text-muted-foreground">Courier: </span>
                <span data-ui="admin/OrderStatusControl/span-2" className="font-medium">{carrier.trim()}</span>
                {trackingNumber?.trim() ? <span data-ui="admin/OrderStatusControl/span-3" className="font-mono"> · {trackingNumber.trim()}</span> : null}
              </>
            ) : (
              "Courier details are needed to mark this order as shipped."
            )}
          </p>
          <Button data-ui="admin/OrderStatusControl/Button" type="button" variant="outline" size="sm" onClick={() => setCourierOpen(true)} className="shrink-0 rounded-full">
            {carrier?.trim() ? "Edit" : "Add details"}
          </Button>
        </div>
      )}

      {!locked && (
        <Button data-ui="admin/OrderStatusControl/Button-update-status" type="submit" disabled={!isDirty || pending} className="w-full rounded-full">
          {pending && <Loader2Icon className="animate-spin" />} Update status
        </Button>
      )}
      <a data-ui="admin/OrderStatusControl/a-send"
        href={notifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 items-center justify-center gap-2 rounded-full bg-whatsapp-solid text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <WhatsAppIcon className="size-4" /> Send “{announcedStage ? announcedStage.customerLabel : STATUS_META[value].label}” update
      </a>
      <ConfirmDialog
        open={toConfirm !== null}
        onOpenChange={(o) => !o && setToConfirm(null)}
        title={toConfirm && toConfirm.values.status !== status ? `Change status to ${STATUS_META[toConfirm.values.status].label}?` : "Save shipping details?"}
        description={toConfirm && toConfirm.values.status !== status ? `This order is now “${STATUS_META[status].label}”. The customer sees the new status on their order page.` : "The customer sees the updated courier details."}
        confirmLabel="Yes, update"
        onConfirm={() => toConfirm && apply(toConfirm)}
      />
    </form>
    {courierOpen && (
      <CourierDialog
        open={courierOpen}
        onOpenChange={setCourierOpen}
        initial={courierValues(shipping)}
        previousExpected={shipping?.expectedDelivery}
        title="Courier details"
        description="Shown to the customer on their order page once the order is shipped."
        saveLabel="Use these details"
        onSave={(_payload, v) => {
          form.setValue("carrier", v.carrier, { shouldDirty: true })
          form.setValue("trackingNumber", v.trackingNumber, { shouldDirty: true })
          form.setValue("trackingUrl", v.trackingUrl, { shouldDirty: true })
          form.setValue("expectedDelivery", v.expectedDelivery, { shouldDirty: true })
          setCourierOpen(false)
        }}
      />
    )}
    </div>
  )
}

/** Cancel an order (until it is packed): pick a reason, the customer sees it, a paid order is flagged for refund. */
export function AdminCancelOrder({ orderId, orderCode, status, paidOrSent }: { orderId: string; orderCode: string; status: OrderStatus; paidOrSent: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>(ADMIN_CANCEL_REASONS[0])
  const [detail, setDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  if (!CANCELLABLE_BY_ADMIN.includes(status)) return null

  const needsDetail = otherNeedsDetail(reason, detail)

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await cancelOrderAsAdmin({ orderId, reason, detail: detail.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      later(() => toast.success("Order cancelled"))
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        data-ui="admin/AdminCancelOrder/DialogTrigger-inline-flex"
        className="inline-flex h-9 w-full items-center justify-center rounded-full border border-destructive/40 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Cancel order
      </DialogTrigger>
      <DialogContent data-ui="admin/AdminCancelOrder/DialogContent">
        <DialogHeader>
          <DialogTitle>Cancel order {orderCode}?</DialogTitle>
          <DialogDescription>
            The customer will see the reason on their order page.{" "}
            {paidOrSent ? "A payment was received, so remember to refund it and mark the payment as Refunded." : "No payment was received."}
          </DialogDescription>
        </DialogHeader>
        <div data-ui="admin/AdminCancelOrder/div" className="space-y-1">
          <SelectField
            label="Reason"
            fieldSize="md"
            value={reason}
            onValueChange={setReason}
            options={ADMIN_CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
          />
          <TextAreaField
            label={reason === OTHER_REASON ? "Reason (the customer will see it)" : "Message to the customer (optional)"}
            required={reason === OTHER_REASON}
            rows={2}
            maxLength={LIMITS.cancelDetail.max}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            error={needsDetail && detail.trim() ? OTHER_DETAIL_MESSAGE : undefined}
          />
          {error && (
            <p data-ui="admin/AdminCancelOrder/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button data-ui="admin/AdminCancelOrder/Button-keep-order" type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Keep order
          </Button>
          <Button data-ui="admin/AdminCancelOrder/Button-cancel-order" type="button" variant="destructive" onClick={submit} disabled={pending || needsDetail} className="rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(note ?? "")
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  return (
    <form data-ui="admin/AdminNoteForm"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const res = await updateAdminNote({ orderId, note: value })
          if (res.ok) {
            later(() => toast.success("Note saved"))
            router.refresh()
          }
          else toast.error(res.error)
        })
      }}
    >
      <TextAreaField
        label="Private note" maxLength={LIMITS.adminNote.max}
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Payment received via UPI, packing notes…"
      />
      <Button data-ui="admin/AdminNoteForm/Button-save-note" type="submit" variant="outline" size="sm" disabled={pending || value === (note ?? "")} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Save note
      </Button>
    </form>
  )
}

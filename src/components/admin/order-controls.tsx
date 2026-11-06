"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FormSelectField, SelectField, TextAreaField, TextField } from "@/components/form"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrderAsAdmin, updateAdminNote, updateOrderStatus } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, checkTransition, statusChoices } from "@/features/orders/transitions"
import { COURIER_SUGGESTIONS, shippingSchema } from "@/features/orders/schema"
import { STATUS_META, type OrderStatus, type PaymentStatus, type ShippingDetails } from "@/features/orders/types"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { buildStatusUpdateMessage, whatsappLink } from "@/features/orders/whatsapp"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"

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
}: {
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  shipping: ShippingDetails | null
}) {
  // Only the current status and the legal next steps are offered (see features/orders/transitions.ts).
  const statusOptions = statusChoices(status).map((s) => ({ value: s, label: STATUS_META[s].label }))
  const router = useRouter()
  const shop = useStoreSettings()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  const form = useForm<Values>({
    defaultValues: {
      status,
      carrier: shipping?.carrier ?? "",
      trackingNumber: shipping?.trackingNumber ?? "",
      trackingUrl: shipping?.trackingUrl ?? "",
      expectedDelivery: shipping?.expectedDelivery ?? "",
    },
  })
  const { errors, isDirty } = form.formState
  const [value, carrier, trackingNumber, trackingUrl, expectedDelivery] = useWatch({
    control: form.control,
    name: ["status", ...SHIPPING_FIELDS],
  })

  // Shipping fields appear when marking an order "Shipped" (or when details already exist, so they can be edited).
  const showShipping = value === "shipped" || Boolean(shipping)
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
    buildStatusUpdateMessage(shop, { orderCode, customerName, status: value, shipping: notifyShipping })
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
      if (values.status === "shipped") form.setError("carrier", { message: "Enter the courier name to mark as shipped" })
      toast.error(problem)
      return
    }

    let shippingPayload: z.output<typeof shippingSchema> | undefined

    if (showShipping && hasAnyShipping) {
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

    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: values.status, expectedStatus: status, shipping: shippingPayload })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(`Status changed to ${STATUS_META[values.status].label}`, {
        action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl, "_blank", "noopener") },
      })
      form.reset(values)
      router.refresh()
    })
  })

  return (
    <form data-ui="admin/OrderStatusControl" onSubmit={onSubmit} noValidate className="space-y-4">
      <FormSelectField control={form.control} name="status" label="Order status" fieldSize="md" options={statusOptions} />

      {showShipping && (
        <fieldset data-ui="admin/OrderStatusControl/fieldset" className="space-y-1 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
          <legend data-ui="admin/OrderStatusControl/legend-shipping-details" className="px-1 text-sm font-semibold">Shipping details</legend>
          <p data-ui="admin/OrderStatusControl/p" className="-mt-2 text-xs text-muted-foreground">
            {value === "shipped" ? "Courier name is required to mark an order as shipped. " : ""}Customers see these on their order page.
          </p>
          <TextField
            label="Courier" maxLength={LIMITS.carrier.max}
            fieldSize="md"
            placeholder="e.g. Delhivery"
            suggestions={COURIER_SUGGESTIONS}
            error={errors.carrier?.message}
            {...form.register("carrier")}
          />
          <TextField
            label="Tracking / AWB number" kind="trackingNumber"
            fieldSize="md"
            className="font-mono"
            error={errors.trackingNumber?.message}
            {...form.register("trackingNumber")}
          />
          <TextField
            label="Tracking link" kind="url"
            fieldSize="md"
            type="url"
            inputMode="url"
            placeholder="https://…"
            hint="Optional. Customers get a “Track shipment” button."
            error={errors.trackingUrl?.message}
            {...form.register("trackingUrl")}
          />
          <TextField
            label="Expected delivery date"
            fieldSize="md"
            type="date"
            error={errors.expectedDelivery?.message}
            {...form.register("expectedDelivery")}
          />
        </fieldset>
      )}

      <Button data-ui="admin/OrderStatusControl/Button-update-status" type="submit" disabled={!isDirty || pending} className="w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Update status
      </Button>
      <a data-ui="admin/OrderStatusControl/a-send"
        href={notifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 items-center justify-center gap-2 rounded-full bg-whatsapp-solid text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <WhatsAppIcon className="size-4" /> Send “{STATUS_META[value].label}” update
      </a>
    </form>
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
      toast.success("Order cancelled")
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
            maxLength={200}
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
  const [value, setValue] = useState(note ?? "")
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  return (
    <form data-ui="admin/AdminNoteForm"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const res = await updateAdminNote({ orderId, note: value })
          if (res.ok) toast.success("Note saved")
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

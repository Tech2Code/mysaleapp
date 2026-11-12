"use client"

import { ArrowRightIcon, BanIcon, CheckIcon, Loader2Icon, LockIcon, RotateCcwIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { FormSelectField, SelectField, SwitchField, TextAreaField } from "@/components/form"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CourierDialog } from "./courier-dialog"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cancelOrderAsAdmin, revertOrderStatus, updateAdminNote, updateOrderStatus } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, OTHER_DETAIL_MIN, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, NEXT_STATUSES, checkTransition, isRevertTransition, statusChoices } from "@/features/orders/transitions"
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
  // Only the current status, legal next steps, and 1-step revert are offered (see features/orders/transitions.ts).
  const nextSteps = NEXT_STATUSES[status]
  const primaryNextStep = nextSteps[0] ?? null
  const statusOptions = statusChoices(status).map((s) => {
    const revert = isRevertTransition(status, s)
    const isNext = nextSteps.includes(s)
    const isDirectShip = status === "confirmed" && s === "shipped"
    return {
      value: s,
      label: revert ? `Revert to ${STATUS_META[s].label} (undo ${STATUS_META[status].label})` : STATUS_META[s].label,
      tone: revert
        ? ("revert" as const)
        : isNext
          ? ("next" as const)
          : s === status
            ? ("current" as const)
            : ("default" as const),
      badge: revert ? "Undo" : isDirectShip ? "Skip to ship" : isNext ? "Next step" : s === status ? "Current" : undefined,
    }
  })
  const router = useRouter()
  const shop = useStoreSettings()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  // The validated change waits here for "are you sure?" (a status change notifies the customer's order page).
  const [toConfirm, setToConfirm] = useState<{ values: Values; shipping: z.output<typeof shippingSchema> | undefined } | null>(null)
  const [revertTarget, setRevertTarget] = useState<OrderStatus | null>(null)

  const form = useForm<Values>({
    defaultValues: {
      status,
      carrier: shipping?.carrier ?? "",
      trackingNumber: shipping?.trackingNumber ?? "",
      trackingUrl: shipping?.trackingUrl ?? "",
      expectedDelivery: shipping?.expectedDelivery ?? "",
    },
  })
  const [value, carrier, trackingNumber, trackingUrl, expectedDelivery] = useWatch({
    control: form.control,
    name: ["status", ...SHIPPING_FIELDS],
  })

  // Shipping fields appear when marking an order "Shipped" (or when details already exist, so they can be edited).
  // Choosing "Shipped" asks for the courier details in a popup (CourierDialog). Once shipped, they are edited from the shipping card's Edit button.
  const showShipping = value === "shipped" && status !== "shipped"
  const [courierOpen, setCourierOpen] = useState(false)
  const hasAnyShipping = [carrier, trackingNumber, trackingUrl, expectedDelivery].some((v) => v?.trim())
  const shippingChanged =
    (carrier ?? "").trim() !== (shipping?.carrier ?? "").trim() ||
    (trackingNumber ?? "").trim() !== (shipping?.trackingNumber ?? "").trim() ||
    (trackingUrl ?? "").trim() !== (shipping?.trackingUrl ?? "").trim() ||
    (expectedDelivery ?? "").trim() !== (shipping?.expectedDelivery ?? "").trim()
  const hasStatusChanges = value !== status || (showShipping && shippingChanged)

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
    if (isRevertTransition(status, values.status)) {
      setRevertTarget(values.status)
      return
    }
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
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: values.status, expectedStatus: status, shipping: shippingPayload })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      form.reset(values)
      later(() => {
        setToConfirm(null)
        toast.success(`Status changed to ${STATUS_META[values.status].label}`, {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl, "_blank", "noopener") },
        })
      })
      router.refresh()
    })
  }

  return (
    <div data-ui="admin/OrderStatusControl" className="space-y-4">
    {/* Delivered: the status dropdown manages the return steps (outside the form: it has its own dialogs). */}
    {status === "delivered" && returnControl}
    <form data-ui="admin/OrderStatusControl/form" onSubmit={onSubmit} noValidate className="min-w-0 max-w-full space-y-4">
      {locked ? (
        <div data-ui="admin/OrderStatusControl/div" className="min-w-0 max-w-full space-y-3">
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
        <div data-ui="admin/OrderStatusControl/div-2" className="space-y-2">
          <FormSelectField control={form.control} name="status" label="Order status" fieldSize="md" options={statusOptions} noErrorSpace />
          {value === status && primaryNextStep && (
            <div data-ui="admin/OrderStatusControl/div-flex" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span data-ui="admin/OrderStatusControl/span-flex" className="flex items-center gap-1.5 text-emerald-950 dark:text-emerald-200">
                <ArrowRightIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span data-ui="admin/OrderStatusControl/span">Next step:</span>
                <strong data-ui="admin/OrderStatusControl/strong" className="font-semibold">{STATUS_META[primaryNextStep].label}</strong>
              </span>
              <button data-ui="admin/OrderStatusControl/button-select"
                type="button"
                onClick={() => form.setValue("status", primaryNextStep, { shouldDirty: true })}
                className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                Select {STATUS_META[primaryNextStep].label} →
              </button>
            </div>
          )}
        </div>
      )}

      {!locked && showShipping && (
        <div data-ui="admin/OrderStatusControl/div-flex-2" className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 text-sm dark:border-violet-900/50 dark:bg-violet-950/20">
          <p data-ui="admin/OrderStatusControl/p-2" className="min-w-0 wrap-anywhere">
            {carrier?.trim() ? (
              <>
                <span data-ui="admin/OrderStatusControl/span-2" className="text-muted-foreground">Courier: </span>
                <span data-ui="admin/OrderStatusControl/span-3" className="font-medium">{carrier.trim()}</span>
                {trackingNumber?.trim() ? <span data-ui="admin/OrderStatusControl/span-4" className="font-mono"> · {trackingNumber.trim()}</span> : null}
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

      {!locked && isRevertTransition(status, value) && (
        <p data-ui="admin/OrderStatusControl/p-flex-2" className="flex items-center gap-2 rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
          <RotateCcwIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span data-ui="admin/OrderStatusControl/span-5">Moves this order one step back ({STATUS_META[status].label} → {STATUS_META[value].label}). Requires a reason in the next popup.</span>
        </p>
      )}

      {!locked && (
        <Button
          data-ui="admin/OrderStatusControl/Button-2"
          type="submit"
          variant={isRevertTransition(status, value) ? "outline" : "default"}
          disabled={!hasStatusChanges || pending}
          className={
            isRevertTransition(status, value)
              ? "w-full gap-1.5 rounded-full border-amber-400 bg-amber-500/15 font-semibold text-amber-950 hover:bg-amber-500/25 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50"
              : "w-full rounded-full"
          }
        >
          {pending ? <Loader2Icon className="animate-spin" /> : isRevertTransition(status, value) ? <RotateCcwIcon className="size-4" /> : null}
          {isRevertTransition(status, value) ? `Revert to ${STATUS_META[value].label}` : "Update status"}
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
    </form>
    <ConfirmDialog
      open={toConfirm !== null}
      onOpenChange={(o) => !o && !pending && setToConfirm(null)}
      title={toConfirm && toConfirm.values.status !== status ? `Change status to ${STATUS_META[toConfirm.values.status].label}?` : "Save shipping details?"}
      description={toConfirm && toConfirm.values.status !== status ? `This order is now “${STATUS_META[status].label}”. The customer sees the new status on their order page.` : "The customer sees the updated courier details."}
      confirmLabel="Yes, update"
      pending={pending}
      onConfirm={() => toConfirm && apply(toConfirm)}
    />
    {revertTarget && (
      <RevertOrderStatusDialog
        open={revertTarget !== null}
        onOpenChange={(o) => !o && setRevertTarget(null)}
        orderId={orderId}
        orderCode={orderCode}
        from={status}
        to={revertTarget}
        hasShipping={Boolean(shipping?.carrier || shipping?.trackingNumber || shipping?.trackingUrl || shipping?.expectedDelivery)}
      />
    )}
    {courierOpen && (
      <CourierDialog
        open={courierOpen}
        onOpenChange={setCourierOpen}
        initial={{
          carrier: carrier || shipping?.carrier || "",
          trackingNumber: trackingNumber || shipping?.trackingNumber || "",
          trackingUrl: trackingUrl || shipping?.trackingUrl || "",
          expectedDelivery: expectedDelivery || shipping?.expectedDelivery || "",
        }}
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

/**
 * Confirmation dialog for reverting an order status by one step (Delivered -> Shipped -> Packed -> Confirmed -> Pending).
 * Requires a mandatory admin reason (saved to the private admin note) and offers an optional checkbox to clear courier details when reverting from Shipped.
 */
export function RevertOrderStatusDialog({
  orderId,
  orderCode,
  from,
  to,
  hasShipping = false,
  open,
  onOpenChange,
}: {
  orderId: string
  orderCode: string
  from: OrderStatus
  to: OrderStatus
  hasShipping?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [reason, setReason] = useState("")
  const [clearShipping, setClearShipping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const trimmedReason = reason.trim()
  const reasonInvalid = trimmedReason.length < OTHER_DETAIL_MIN

  const handleClose = (nextOpen: boolean) => {
    if (pending) return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setReason("")
      setClearShipping(false)
      setError(null)
    }
  }

  const submit = () =>
    startTransition(async () => {
      setError(null)
      if (reasonInvalid) {
        setError(OTHER_DETAIL_MESSAGE)
        return
      }
      const res = await revertOrderStatus({
        orderId,
        expectedStatus: from,
        toStatus: to,
        reason: trimmedReason,
        clearShipping: from === "shipped" ? clearShipping : false,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      later(() => {
        handleClose(false)
        toast.success(`Order reverted to ${STATUS_META[to].label}`)
      })
      router.refresh()
    })

  const descriptionText =
    from === "confirmed" && to === "pending"
      ? "Moves the order back to Pending while keeping the payment marked as Paid. The customer can edit their delivery address again while the order is Pending."
      : from === "shipped" && to === "packed"
        ? "Moves the order back to Packed. Courier details are hidden from the customer while Packed and stay saved for when you mark it Shipped again (unless you clear them below)."
        : `Moves the order back from ${STATUS_META[from].label} to ${STATUS_META[to].label}. Your reason is recorded in the private admin note (hidden from the customer).`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-ui="admin/RevertOrderStatusDialog/DialogContent" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Revert order {orderCode} to {STATUS_META[to].label}?</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <TextAreaField
            label="Reason for reverting (private admin note)"
            required
            rows={2}
            maxLength={LIMITS.cancelDetail.max}
            placeholder="e.g. Marked by mistake, customer requested address change…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
            error={trimmedReason.length > 0 && reasonInvalid ? OTHER_DETAIL_MESSAGE : undefined}
          />
          {from === "shipped" && hasShipping && (
            <SwitchField
              label="Clear courier & tracking details"
              description="Leave off to keep courier details saved for when you mark it Shipped again"
              checked={clearShipping}
              onCheckedChange={setClearShipping}
            />
          )}
          {error && (
            <p data-ui="admin/RevertOrderStatusDialog/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-ui="admin/RevertOrderStatusDialog/Button-cancel" type="button" variant="outline" disabled={pending} onClick={() => handleClose(false)} className="gap-1.5 rounded-full">
            <XIcon className="size-4" /> Cancel
          </Button>
          <Button data-ui="admin/RevertOrderStatusDialog/Button-revert-to" type="button" onClick={submit} disabled={pending || reasonInvalid} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon className="size-4" />} Revert to {STATUS_META[to].label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Cancel an order (until it is packed): pick a reason, the customer sees it, a paid order is flagged for refund. */
export function AdminCancelOrder({ orderId, orderCode, status, paidOrSent }: { orderId: string; orderCode: string; status: OrderStatus; paidOrSent: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>("")
  const [detail, setDetail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  if (!CANCELLABLE_BY_ADMIN.includes(status)) return null

  const needsDetail = !reason || otherNeedsDetail(reason, detail)

  const submit = () =>
    startTransition(async () => {
      setError(null)
      if (!reason) {
        setError("Please choose a reason.")
        return
      }
      const res = await cancelOrderAsAdmin({ orderId, reason, detail: detail.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Order cancelled")
      })
      router.refresh()
    })

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setDetail("")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        data-ui="admin/AdminCancelOrder/DialogTrigger-inline-flex"
        className="inline-flex h-9 w-full items-center justify-center rounded-full border border-destructive/40 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Cancel order
      </DialogTrigger>
      <DialogContent data-ui="admin/AdminCancelOrder/DialogContent" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order {orderCode}?</DialogTitle>
          <DialogDescription>
            The customer will see the reason on their order page.{" "}
            {paidOrSent ? "A payment was received, so remember to refund it and mark the payment as Refunded." : "No payment was received."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-2">
          <SelectField
            label="Reason *"
            placeholder="Select a reason"
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
            error={Boolean(reason) && needsDetail && detail.trim() ? OTHER_DETAIL_MESSAGE : undefined}
          />
          {error && (
            <p data-ui="admin/AdminCancelOrder/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-ui="admin/AdminCancelOrder/Button-keep-order" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <CheckIcon className="size-4" /> Keep order
          </Button>
          <Button data-ui="admin/AdminCancelOrder/Button-cancel-order" type="button" variant="destructive" onClick={submit} disabled={pending || needsDetail} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <BanIcon className="size-4" />} Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const REVERT_AUDIT_LINE_RE = /^\[([^\]]+)\] Reverted (.+ → .+): (.+)$/

function parseAdminNoteParts(raw: string | null): {
  editableNote: string
  auditEntries: { raw: string; timestamp: string; transition: string; reason: string }[]
} {
  if (!raw) return { editableNote: "", auditEntries: [] }
  const lines = raw.split(/\r?\n/)
  const editableLines: string[] = []
  const auditEntries: { raw: string; timestamp: string; transition: string; reason: string }[] = []

  for (const line of lines) {
    const match = REVERT_AUDIT_LINE_RE.exec(line.trim())
    if (match) {
      auditEntries.push({
        raw: line.trim(),
        timestamp: match[1] ?? "",
        transition: match[2] ?? "",
        reason: match[3] ?? "",
      })
    } else {
      editableLines.push(line)
    }
  }

  return {
    editableNote: editableLines.join("\n").trim(),
    auditEntries,
  }
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const router = useRouter()
  const { editableNote, auditEntries } = parseAdminNoteParts(note)
  const [value, setValue] = useState(editableNote)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)
  const unchanged = value.trim() === editableNote

  return (
    <div data-ui="admin/AdminNoteForm" className="space-y-4">
      <form
        data-ui="admin/AdminNoteForm/form"
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (unchanged) return
          startTransition(async () => {
            const res = await updateAdminNote({ orderId, note: value })
            if (res.ok) {
              later(() => toast.success("Note saved"))
              router.refresh()
            } else toast.error(res.error)
          })
        }}
      >
        <TextAreaField
          label="Private note"
          maxLength={LIMITS.adminNote.max}
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Payment received via UPI, packing notes…"
        />
        <Button data-ui="admin/AdminNoteForm/Button-save-note" type="submit" variant="outline" size="sm" disabled={pending || unchanged} className="rounded-full">
          {pending && <Loader2Icon className="animate-spin" />} Save note
        </Button>
      </form>

      {auditEntries.length > 0 && (
        <div data-ui="admin/AdminNoteForm/div" className="space-y-2 border-t pt-3">
          <div data-ui="admin/AdminNoteForm/div-flex" className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
            <span data-ui="admin/AdminNoteForm/span-flex" className="flex items-center gap-1.5">
              <RotateCcwIcon className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />
              Status revert log
            </span>
            <span data-ui="admin/AdminNoteForm/span-inline-flex" className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
              <LockIcon className="size-2.5" aria-hidden /> Locked
            </span>
          </div>
          <ul data-ui="admin/AdminNoteForm/ul" className="space-y-2">
            {auditEntries.map((entry, idx) => (
              <li data-ui="admin/AdminNoteForm/li"
                key={`${entry.timestamp}-${idx}`}
                className="rounded-xl border border-amber-300/60 bg-amber-50/50 p-2.5 text-xs dark:border-amber-800/50 dark:bg-amber-950/20"
              >
                <div data-ui="admin/AdminNoteForm/div-flex-2" className="flex flex-wrap items-center justify-between gap-1 font-semibold text-amber-950 dark:text-amber-200">
                  <span data-ui="admin/AdminNoteForm/span">{entry.transition}</span>
                  <span data-ui="admin/AdminNoteForm/span-2" className="font-normal text-[11px] text-muted-foreground">{entry.timestamp}</span>
                </div>
                <p data-ui="admin/AdminNoteForm/p" className="mt-1 text-foreground/90">{entry.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

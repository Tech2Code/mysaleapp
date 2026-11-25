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
import styles from "./admin-orders.module.css"

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

  const savedNotifyUrl = whatsappLink(
    `91${phone}`,
    buildStatusUpdateMessage(shop, { orderCode, customerName, status, shipping, returnStage: announcedStage })
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
      const nextShipping: ShippingDetails | null = shippingPayload
        ? {
            carrier: shippingPayload.carrier,
            trackingNumber: shippingPayload.trackingNumber ?? null,
            trackingUrl: shippingPayload.trackingUrl ?? null,
            expectedDelivery: shippingPayload.expectedDelivery ?? null,
          }
        : shipping
      const updatedNotifyUrl = whatsappLink(
        `91${phone}`,
        buildStatusUpdateMessage(shop, { orderCode, customerName, status: values.status, shipping: nextShipping, returnStage: announcedStage })
      )
      later(() => {
        setToConfirm(null)
        toast.success(`Status changed to ${STATUS_META[values.status].label}`, {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(updatedNotifyUrl, "_blank", "noopener") },
        })
      })
      router.refresh()
    })
  }

  return (
    <div className={styles.statusControlRoot}>
    {/* Delivered: the status dropdown manages the return steps (outside the form: it has its own dialogs). */}
    {status === "delivered" && returnControl}
    <form onSubmit={onSubmit} noValidate className={styles.statusForm}>
      {locked ? (
        <div className={styles.lockedBlock}>
          {!(status === "delivered" && returnControl) && (
            <p role="note" className={styles.lockedBanner}>
              <LockIcon className={styles.iconMd} aria-hidden /> {note}
            </p>
          )}
          {/* Courier details are not repeated here: the progress timeline shows them under "Shipped". */}
          <p className={styles.lockedSub}>
            {status === "cancelled"
              ? "Cancelled order details stay locked. You can still add or update a private note below."
              : "Delivered order details stay locked. You can still add a private note and manage the return from the status above."}
          </p>
        </div>
      ) : (
        <div className={styles.selectBlock}>
          <FormSelectField control={form.control} name="status" label="Order status" fieldSize="md" options={statusOptions} noErrorSpace />
          {value === status && primaryNextStep && (
            <div className={styles.nextStepBanner}>
              <span className={styles.nextStepLabel}>
                <ArrowRightIcon className={styles.nextStepIcon} aria-hidden />
                <span>Next step:</span>
                <strong className={styles.nextStepStrong}>{STATUS_META[primaryNextStep].label}</strong>
              </span>
              <button
                type="button"
                onClick={() => form.setValue("status", primaryNextStep, { shouldDirty: true })}
                className={styles.nextStepQuickBtn}
              >
                Select {STATUS_META[primaryNextStep].label} →
              </button>
            </div>
          )}
        </div>
      )}

      {!locked && showShipping && (
        <div className={styles.shippingBox}>
          <p className={styles.shippingText}>
            {carrier?.trim() ? (
              <>
                <span className={styles.shippingMuted}>Courier: </span>
                <span className={styles.shippingCarrier}>{carrier.trim()}</span>
                {trackingNumber?.trim() ? <span className={styles.shippingTracking}> · {trackingNumber.trim()}</span> : null}
              </>
            ) : (
              "Courier details are needed to mark this order as shipped."
            )}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setCourierOpen(true)} className={styles.shippingEditBtn}>
            {carrier?.trim() ? "Edit" : "Add details"}
          </Button>
        </div>
      )}

      {!locked && isRevertTransition(status, value) && (
        <p className={styles.revertWarnBanner}>
          <RotateCcwIcon className={styles.revertWarnIcon} aria-hidden />
          <span>Moves this order one step back ({STATUS_META[status].label} → {STATUS_META[value].label}). Requires a reason in the next popup.</span>
        </p>
      )}

      {!locked && (
        <Button

          type="submit"
          variant={isRevertTransition(status, value) ? "outline" : "default"}
          disabled={!hasStatusChanges || pending}
          className={
            isRevertTransition(status, value)
              ? styles.revertSubmitBtn
              : styles.pillBtnFull
          }
        >
          {pending ? <Loader2Icon className={styles.spinIcon} /> : isRevertTransition(status, value) ? <RotateCcwIcon className={styles.iconMd} /> : null}
          {isRevertTransition(status, value) ? `Revert to ${STATUS_META[value].label}` : "Update status"}
        </Button>
      )}
      <a
        href={savedNotifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.whatsappSendBtn}
      >
        <WhatsAppIcon className={styles.iconMd} /> Send “{announcedStage ? announcedStage.customerLabel : STATUS_META[status].label}” update
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
  const [submitted, setSubmitted] = useState(false)
  const [reasonError, setReasonError] = useState<string | null>(null)
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
      setSubmitted(false)
      setReasonError(null)
    }
  }

  const submit = () => {
    setSubmitted(true)
    setReasonError(null)
    if (reasonInvalid) return
    startTransition(async () => {
      const res = await revertOrderStatus({
        orderId,
        expectedStatus: from,
        toStatus: to,
        reason: trimmedReason,
        clearShipping: from === "shipped" ? clearShipping : false,
      })
      if (!res.ok) {
        if (res.fieldErrors?.reason?.[0]) setReasonError(res.fieldErrors.reason[0])
        toast.error(res.error)
        return
      }
      later(() => {
        handleClose(false)
        toast.success(`Order reverted to ${STATUS_META[to].label}`)
      })
      router.refresh()
    })
  }

  const descriptionText =
    from === "confirmed" && to === "pending"
      ? "Moves the order back to Pending while keeping the payment marked as Paid. The customer can edit their delivery address again while the order is Pending."
      : from === "shipped" && to === "packed"
        ? "Moves the order back to Packed. Courier details are hidden from the customer while Packed and stay saved for when you mark it Shipped again (unless you clear them below)."
        : `Moves the order back from ${STATUS_META[from].label} to ${STATUS_META[to].label}. Your reason is recorded in the private admin note (hidden from the customer).`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={styles.dialogSmMax}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>Revert order {orderCode} to {STATUS_META[to].label}?</DialogTitle>
          <DialogDescription>{descriptionText}</DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.dialogBodyStack3}>
          <TextAreaField
            label="Reason for reverting (private admin note)"
            required
            rows={2}
            maxLength={LIMITS.cancelDetail.max}
            placeholder="e.g. Marked by mistake, customer requested address change…"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (reasonError) setReasonError(null)
            }}
            error={reasonError ?? ((submitted || trimmedReason.length > 0) && reasonInvalid ? OTHER_DETAIL_MESSAGE : undefined)}
          />
          {from === "shipped" && hasShipping && (
            <SwitchField
              label="Clear courier & tracking details"
              description="Leave off to keep courier details saved for when you mark it Shipped again"
              checked={clearShipping}
              onCheckedChange={setClearShipping}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleClose(false)} className={styles.pillBtnGap}>
            <XIcon className={styles.iconMd} /> Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending} className={styles.pillBtnGap}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <RotateCcwIcon className={styles.iconMd} />} Revert to {STATUS_META[to].label}
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
  const [submitted, setSubmitted] = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  if (!CANCELLABLE_BY_ADMIN.includes(status)) return null

  const needsDetail = !reason || otherNeedsDetail(reason, detail)

  const submit = () => {
    setSubmitted(true)
    setServerFieldErrors({})
    if (!reason || needsDetail) return
    startTransition(async () => {
      const res = await cancelOrderAsAdmin({ orderId, reason, detail: detail.trim() || undefined })
      if (!res.ok) {
        const nextFieldErrors: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) nextFieldErrors[k] = msgs[0]
        }
        setServerFieldErrors(nextFieldErrors)
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Order cancelled")
      })
      router.refresh()
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setReason("")
      setDetail("")
      setSubmitted(false)
      setServerFieldErrors({})
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger

        className={styles.cancelTriggerBtn}
      >
        Cancel order
      </DialogTrigger>
      <DialogContent className={styles.dialogSmMax}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>Cancel order {orderCode}?</DialogTitle>
          <DialogDescription>
            The customer will see the reason on their order page.{" "}
            {paidOrSent ? "A payment was received, so remember to refund it and mark the payment as Refunded." : "No payment was received."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.dialogBodyStack2}>
          <SelectField
            label="Reason *"
            placeholder="Select a reason"
            fieldSize="md"
            value={reason}
            onValueChange={(val) => {
              setReason(val)
              if (serverFieldErrors.reason) setServerFieldErrors((p) => ({ ...p, reason: "" }))
            }}
            options={ADMIN_CANCEL_REASONS.map((r) => ({ value: r, label: r }))}
            error={serverFieldErrors.reason || (submitted && !reason ? "Please choose a reason" : undefined)}
          />
          <TextAreaField
            label={reason === OTHER_REASON ? "Reason (the customer will see it)" : "Message to the customer (optional)"}
            required={reason === OTHER_REASON}
            rows={2}
            maxLength={LIMITS.cancelDetail.max}
            value={detail}
            onChange={(e) => {
              setDetail(e.target.value)
              if (serverFieldErrors.detail) setServerFieldErrors((p) => ({ ...p, detail: "" }))
            }}
            error={
              serverFieldErrors.detail ||
              ((submitted || Boolean(detail.trim())) && reason === OTHER_REASON && otherNeedsDetail(reason, detail)
                ? OTHER_DETAIL_MESSAGE
                : undefined)
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtnGap}>
            <CheckIcon className={styles.iconMd} /> Keep order
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending} className={styles.pillBtnGap}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <BanIcon className={styles.iconMd} />} Cancel order
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
    <div className={styles.noteFormRoot}>
      <form

        className={styles.noteForm}
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
        <Button type="submit" variant="outline" size="sm" disabled={pending || unchanged} className={styles.pillBtn}>
          {pending && <Loader2Icon className={styles.spinIcon} />} Save note
        </Button>
      </form>

      {auditEntries.length > 0 && (
        <div className={styles.auditSection}>
          <div className={styles.auditHeader}>
            <span className={styles.auditTitle}>
              <RotateCcwIcon className={styles.auditIcon} aria-hidden />
              Status revert log
            </span>
            <span className={styles.lockedPill}>
              <LockIcon className={styles.icon2xs} aria-hidden /> Locked
            </span>
          </div>
          <ul className={styles.auditList}>
            {auditEntries.map((entry, idx) => (
              <li
                key={`${entry.timestamp}-${idx}`}
                className={styles.auditEntry}
              >
                <div className={styles.auditEntryHeader}>
                  <span>{entry.transition}</span>
                  <span className={styles.auditTime}>{entry.timestamp}</span>
                </div>
                <p className={styles.auditReason}>{entry.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

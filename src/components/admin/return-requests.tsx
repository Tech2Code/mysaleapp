"use client"

import { ArrowLeftRightIcon, BanIcon, CheckIcon, Loader2Icon, MapPinIcon, PackageOpenIcon, PlusIcon, ShieldCheckIcon, TruckIcon, UserIcon, WalletIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { DateField, TextAreaField, TextField } from "@/components/form"
import { z } from "zod"
import { CourierDialog, courierValues, type CourierPayload } from "@/components/admin/courier-dialog"
import { COURIER_SUGGESTIONS, shippingSchema } from "@/features/orders/schema"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { advanceExchangeFulfillment, decideReturnRequest, markReturnPickedUp, undoReturnStep } from "@/features/orders/admin-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { requestStatusMeta, returnLineKey, splitReturnDetails, type ReturnStage } from "@/features/orders/returns"
import type { ExchangeMode, OrderItem, OrderReturn, ReturnRequest } from "@/features/orders/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TONES } from "@/components/shared/status-badge"
import { ReturnStageBadge } from "@/components/shared/return-stage-badge"
import { ReturnsList } from "@/components/shared/returns-list"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { LIMITS, addDays, todayIST } from "@/lib/validation"
import styles from "./admin-orders.module.css"

/** Approve (with instructions) or reject (with a reason) one pending request. */
export function DecideDialog({
  request,
  approve,
}: {
  request: ReturnRequest
  approve: boolean
  orderCode: string
  customerName: string
  phone: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [pickupDate, setPickupDate] = useState("")
  const [exchangeMode, setExchangeMode] = useState<ExchangeMode>("standard")
  const [showDoorstepCourier, setShowDoorstepCourier] = useState(false)
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [courierErrors, setCourierErrors] = useState<{ carrier?: string; trackingNumber?: string; trackingUrl?: string }>({})
  const [bounds, setBounds] = useState<{ min?: string; max?: string }>({})
  const [pickupError, setPickupError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [noteTouched, setNoteTouched] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const clearDoorstepCourier = () => {
    setShowDoorstepCourier(false)
    setCarrier("")
    setTrackingNumber("")
    setTrackingUrl("")
    setCourierErrors({})
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      const today = todayIST()
      setBounds({ min: today, max: addDays(today, LIMITS.pickupDays.max) })
    } else {
      setNote("")
      setPickupDate("")
      setExchangeMode("standard")
      clearDoorstepCourier()
      setPickupError(null)
      setNoteError(null)
      setNoteTouched(false)
    }
  }

  const submit = () => {
    setNoteError(null)
    setPickupError(null)
    setCourierErrors({})
    if (approve && !pickupDate) {
      setPickupError(request.resolutionType === "exchange" && exchangeMode === "doorstep" ? "Pick the doorstep exchange date" : "Pick the pickup date")
      return
    }
    if (!approve && note.trim().length < 3) {
      setNoteError("Enter the reason for rejecting (at least 3 characters)")
      return
    }
    const isExchange = request.resolutionType === "exchange"
    const chosenMode: ExchangeMode | undefined = approve && isExchange ? exchangeMode : undefined
    let shippingPayload: CourierPayload | undefined
    if (chosenMode === "doorstep" && showDoorstepCourier) {
      const parsed = shippingSchema.safeParse({
        carrier,
        trackingNumber,
        trackingUrl,
        expectedDelivery: pickupDate,
      })
      if (!parsed.success) {
        const fe = z.flattenError(parsed.error).fieldErrors
        setCourierErrors({
          carrier: fe.carrier?.[0],
          trackingNumber: fe.trackingNumber?.[0],
          trackingUrl: fe.trackingUrl?.[0],
        })
        return
      }
      shippingPayload = parsed.data
    }
    startTransition(async () => {
      const res = await decideReturnRequest({
        requestId: request.id,
        approve,
        note: note.trim() || undefined,
        pickupDate: approve ? pickupDate : undefined,
        exchangeMode: chosenMode,
        ...(shippingPayload ? { shipping: shippingPayload } : {}),
      })
      if (!res.ok) {
        setPickupError(res.fieldErrors?.pickupDate?.[0] ?? null)
        setNoteError(res.fieldErrors?.note?.[0] ?? null)
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        setNote("")
        setPickupDate("")
        setExchangeMode("standard")
        clearDoorstepCourier()
        setPickupError(null)
        setNoteError(null)
        toast.success(
          approve
            ? isExchange
              ? chosenMode === "doorstep"
                ? "Doorstep exchange approved"
                : "Exchange approved"
              : "Return approved"
            : isExchange
              ? "Exchange rejected"
              : "Return rejected"
        )
      })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={buttonVariants({
          variant: approve ? "primary" : "destructiveOutline",
          size: "sm",
          fullWidth: true,
        })}
      >
        {approve ? "Approve" : "Reject"}
      </DialogTrigger>
      <DialogContent mobileFullScreen className={styles.dialogSmMax}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>
            {approve
              ? request.resolutionType === "exchange"
                ? "Approve this exchange?"
                : "Approve this return?"
              : request.resolutionType === "exchange"
                ? "Reject this exchange?"
                : "Reject this return?"}
          </DialogTitle>
          <DialogDescription>
            {approve
              ? request.resolutionType === "exchange" && exchangeMode === "doorstep"
                ? "Choose the doorstep handover date. Optionally add shipping details if a courier partner is delivering the swap."
                : "Choose the day the items will be picked up. The customer sees the date and your note on their order page."
              : "The customer will see your reason on their order page. Be specific and polite."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {request.resolutionType === "exchange" && (
            <div className={styles.exchangeRequestAlert}>
              <p className={styles.alertTitle}>
                <ArrowLeftRightIcon className={styles.iconSm} aria-hidden /> Customer requested an Exchange / Replacement
              </p>
              {request.exchangePreference && (
                <p className={styles.exchangePrefText}>
                  <span className={styles.boldSpan}>Preference: </span>
                  {request.exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "")}
                </p>
              )}
            </div>
          )}
          {splitReturnDetails(request.details).pickupAddress && (
            <div className={styles.altPickupAlert}>
              <p className={styles.alertTitle}>
                <MapPinIcon className={styles.iconSm} aria-hidden /> Alternate pickup address requested
              </p>
              <p className={styles.altPickupText}>
                {splitReturnDetails(request.details).pickupAddress}
              </p>
            </div>
          )}
          {approve && request.resolutionType === "exchange" && (
            <div className={styles.exchangeModeGroup} role="radiogroup" aria-label="Exchange fulfilment method">
              <span className={styles.exchangeModeLabel}>Exchange method</span>
              <div className={styles.exchangeModeGrid}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={exchangeMode === "standard"}
                  onClick={() => {
                    setExchangeMode("standard")
                    clearDoorstepCourier()
                  }}
                  className={cn(styles.exchangeModeBtn, exchangeMode === "standard" && styles.exchangeModeBtnActive)}
                >
                  <span className={styles.exchangeModeTitle}>Standard (Pickup & QC)</span>
                  <span className={styles.exchangeModeDesc}>Collect old item → inspect at shop → dispatch new item</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={exchangeMode === "doorstep"}
                  onClick={() => setExchangeMode("doorstep")}
                  className={cn(styles.exchangeModeBtn, exchangeMode === "doorstep" && styles.exchangeModeBtnActive)}
                >
                  <span className={styles.exchangeModeTitle}>Doorstep Exchange</span>
                  <span className={styles.exchangeModeDesc}>1-visit swap: deliver new item & collect old item together</span>
                </button>
              </div>
            </div>
          )}
          {approve && (
            <DateField
              label={request.resolutionType === "exchange" && exchangeMode === "doorstep" ? "Expected doorstep swap by *" : "Expected pickup by *"}
              fieldSize="md"
              min={bounds.min}
              max={bounds.max}
              value={pickupDate}
              onChange={(val) => {
                setPickupDate(val)
                if (pickupError) setPickupError(null)
              }}
              error={pickupError ?? undefined}
            />
          )}
          {approve && request.resolutionType === "exchange" && exchangeMode === "doorstep" && (
            !showDoorstepCourier ? (
              <button
                type="button"
                onClick={() => setShowDoorstepCourier(true)}
                className={styles.addDoorstepCourierBtn}
              >
                <PlusIcon className={styles.iconSm} aria-hidden /> Add shipping details (optional)
              </button>
            ) : (
              <div className={styles.doorstepCourierBox}>
                <div className={styles.doorstepCourierHeader}>
                  <p className={styles.doorstepCourierHeading}>
                    <TruckIcon className={styles.iconSm} aria-hidden /> Shipping details
                  </p>
                  <button
                    type="button"
                    onClick={clearDoorstepCourier}
                    className={styles.removeDoorstepCourierBtn}
                  >
                    <XIcon className={styles.iconXs} aria-hidden /> Remove
                  </button>
                </div>
                <TextField
                  label="Courier"
                  required
                  maxLength={LIMITS.carrier.max}
                  fieldSize="md"
                  placeholder="e.g. Delhivery"
                  suggestions={COURIER_SUGGESTIONS}
                  value={carrier}
                  onChange={(e) => {
                    setCarrier(e.target.value)
                    if (courierErrors.carrier) setCourierErrors((prev) => ({ ...prev, carrier: undefined }))
                  }}
                  error={courierErrors.carrier}
                />
                <TextField
                  label="Tracking / AWB number"
                  kind="trackingNumber"
                  fieldSize="md"
                  placeholder="Optional"
                  className={styles.monoText}
                  value={trackingNumber}
                  onChange={(e) => {
                    setTrackingNumber(e.target.value)
                    if (courierErrors.trackingNumber) setCourierErrors((prev) => ({ ...prev, trackingNumber: undefined }))
                  }}
                  error={courierErrors.trackingNumber}
                />
                <TextField
                  label="Tracking link"
                  kind="url"
                  fieldSize="md"
                  type="url"
                  inputMode="url"
                  placeholder="https://… (optional)"
                  value={trackingUrl}
                  onChange={(e) => {
                    setTrackingUrl(e.target.value)
                    if (courierErrors.trackingUrl) setCourierErrors((prev) => ({ ...prev, trackingUrl: undefined }))
                  }}
                  error={courierErrors.trackingUrl}
                />
              </div>
            )
          )}
          <TextAreaField
            label={approve ? "Note for the customer (optional)" : "Reason (required)"}
            required={!approve}
            rows={3}
            maxLength={LIMITS.returnDetail.max}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              if (noteError) setNoteError(null)
            }}
            onBlur={() => setNoteTouched(true)}
            error={
              noteError ??
              (!approve && noteTouched && note.trim().length < 3
                ? "Enter at least 3 characters"
                : undefined)
            }
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtnGap}>
            <XIcon className={styles.iconMd} /> Cancel
          </Button>
          <Button

            type="button"
            variant={approve ? "default" : "destructive"}
            onClick={submit}
            disabled={pending}
            className={styles.pillBtnGap}
          >
            {pending ? <Loader2Icon className={styles.spinIcon} /> : approve ? <CheckIcon className={styles.iconMd} /> : <BanIcon className={styles.iconMd} />}{" "}
            {approve
              ? request.resolutionType === "exchange"
                ? exchangeMode === "doorstep"
                  ? "Approve doorstep exchange"
                  : "Approve exchange"
                : "Approve return"
              : request.resolutionType === "exchange"
                ? "Reject exchange"
                : "Reject return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** "Pickup successful": the courier collected the goods. Asks first, so a mis-click does nothing. */
export function PickedUpButton({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const confirm = () =>
    startTransition(async () => {
      const res = await markReturnPickedUp({ requestId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Pickup marked successful")
      })
      router.refresh()
    })

  return (
    <>
      <Button

        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={styles.pickupSuccessBtn}
      >
        Pickup successful
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !pending && setOpen(o)}
        title="Mark the pickup as successful?"
        description="The customer will see that their items were collected. Do this only after the courier has the parcel."
        confirmLabel="Yes, picked up"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  )
}

/** "Undo the last step" of a return request (mis-click safety net). Asks first. */
export function UndoStepButton({ requestId, title, description }: { requestId: string; title: string; description: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const confirm = () =>
    startTransition(async () => {
      const res = await undoReturnStep({ requestId })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Step undone")
      })
      router.refresh()
    })

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className={styles.pillBtn}>
        Undo this step
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !pending && setOpen(o)}
        title={title}
        description={description}
        confirmLabel="Yes, undo"
        pending={pending}
        onConfirm={confirm}
      />
    </>
  )
}

/** Dispatch or mark delivered for an exchange/replacement after old items are received. */
export function ExchangeFulfillmentControl({
  request,
  mode,
}: {
  request: ReturnRequest
  mode: "dispatched" | "delivered" | "undo_dispatched" | "undo_delivered" | "set_courier"
  orderCode: string
  customerName: string
  phone: string
  stage: ReturnStage | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const isRep = /^replacement\s*:/i.test(request.exchangePreference ?? "")
  const kind = isRep ? "replacement" : "exchange"

  const run = (shipping?: CourierPayload) => {
    const trackingSummary = shipping
      ? shipping.trackingNumber
        ? `${shipping.carrier} · ${shipping.trackingNumber}`
        : shipping.carrier
      : undefined
    startTransition(async () => {
      const res = await advanceExchangeFulfillment({
        requestId: request.id,
        stage: mode,
        ...(trackingSummary ? { tracking: trackingSummary } : {}),
        ...(shipping ? { shipping } : {}),
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        const msg =
          mode === "set_courier"
            ? "Courier details saved"
            : mode === "dispatched"
              ? `${isRep ? "Replacement" : "Exchange"} marked dispatched`
              : mode === "delivered"
                ? `${isRep ? "Replacement" : "Exchange"} marked delivered (Complete)`
                : "Step undone"
        toast.success(msg)
      })
      router.refresh()
    })
  }

  if (mode === "set_courier") {
    const hasCourier = Boolean(request.exchangeShipping)
    return (
      <>
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className={styles.dispatchTriggerBtn}>
          <TruckIcon className={styles.iconSm} aria-hidden /> {hasCourier ? "Edit courier details" : "Add courier details"}
        </Button>
        <CourierDialog
          open={open}
          onOpenChange={setOpen}
          initial={courierValues(request.exchangeShipping)}
          previousExpected={request.exchangeShipping?.expectedDelivery}
          title={hasCourier ? "Edit doorstep exchange courier" : "Add doorstep exchange courier"}
          description="Optional courier & tracking info for the doorstep handover. Customers see this on their order tracking page."
          saveLabel="Save courier details"
          requireChanges={hasCourier}
          pending={pending}
          onSave={(payload) => run(payload)}
        />
      </>
    )
  }

  if (mode === "dispatched") {
    return (
      <>
        <Button type="button" onClick={() => setOpen(true)} className={styles.dispatchTriggerBtn}>
          <TruckIcon className={styles.iconSm} aria-hidden /> {isRep ? "Dispatch replacement" : "Dispatch exchange item"}
        </Button>
        <CourierDialog
          open={open}
          onOpenChange={setOpen}
          initial={courierValues(request.exchangeShipping)}
          title={isRep ? "Dispatch same-item replacement" : "Dispatch exchange item"}
          description={
            isRep
              ? "Enter the courier details for the fresh same-item replacement (same size & colour). Customers see these on their tracking page."
              : "Enter the courier details for the customer's requested size/variant. Customers see these on their tracking page."
          }
          saveLabel="Confirm dispatch"
          pending={pending}
          onSave={(payload) => run(payload)}
        />
      </>
    )
  }

  const confirmCopy =
    mode === "delivered"
      ? {
          btn: isRep ? "Mark replacement delivered" : "Mark exchange delivered",
          title: isRep ? "Mark replacement as delivered?" : "Mark exchange as delivered (Complete)?",
          desc: `This completes the ${kind} lifecycle and notifies the customer that their ${kind} item has arrived.`,
          confirm: "Yes, mark delivered",
        }
      : mode === "undo_dispatched"
        ? {
            btn: "Undo dispatch",
            title: `Undo ${kind} dispatch?`,
            desc: "Moves the status back to old item received (ready to dispatch).",
            confirm: "Yes, undo",
          }
        : {
            btn: "Undo delivered",
            title: `Undo ${kind} delivered?`,
            desc: `Moves the status back to ${kind} dispatched (on the way).`,
            confirm: "Yes, undo",
          }

  return (
    <>
      <Button type="button" variant={mode === "delivered" ? "default" : "outline"} onClick={() => setOpen(true)} className={styles.pillBtn}>
        {confirmCopy.btn}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !pending && setOpen(o)}
        title={confirmCopy.title}
        description={confirmCopy.desc}
        confirmLabel={confirmCopy.confirm}
        pending={pending}
        onConfirm={() => run()}
      />
    </>
  )
}

/** Customer return requests on the admin order page. */
export function AdminReturnRequests({
  requests,
  returns,
  returnStage,
  admin,
}: {
  requests: ReturnRequest[]
  returns: OrderReturn[]
  returnStage: ReturnStage | null
  admin?: {
    items: OrderItem[]
    paymentStatus: string
    refundedAmount: number
    discountAmount?: number
    paidAmount?: number
    refundUpiId?: string | null
    paymentReference?: string | null
    customerName?: string
    orderCode?: string
  }
}) {
  if (requests.length === 0 && returns.length === 0) return null
  const latestRefundUpi =
    admin?.refundUpiId ??
    (requests.map((req) => splitReturnDetails(req.details).refundUpiId).filter(Boolean).at(-1) || null)
  const adminWithContext = admin ? { ...admin, refundUpiId: latestRefundUpi } : undefined
  return (
    <section id="returns" aria-label="Returns" className={styles.returnsSection}>
      <div className={styles.returnsHeader}>
        <h2 className={styles.returnsHeading}>
          <PackageOpenIcon className={styles.returnsIcon} aria-hidden /> Returns
        </h2>
        <ReturnStageBadge stage={returnStage} audience="admin" alwaysShow />
      </div>
      {/* Newest stage first: goods received back (the later stage) above the requests. */}
      <ReturnsList bare returns={returns.toReversed()} audience="admin" refundedInFull={admin?.paymentStatus === "refunded"} admin={adminWithContext} />
      {requests.length > 0 && <h4 className={styles.requestsSubheading}>Return requests</h4>}
      <ul className={requests.length === 0 ? styles.requestsListHidden : styles.requestsList}>
        {requests.toReversed().map((r) => {
          const meta = requestStatusMeta(r.status, "admin", r.resolutionType, r.exchangePreference, r.exchangeStatus)
          const isExchange = r.resolutionType === "exchange"
          const isReplacement = isExchange && /^replacement\s*:/i.test(r.exchangePreference ?? "")
          const cleanPref = (r.exchangePreference ?? "").replace(/^(Replacement|Exchange)\s*:\s*/i, "")
          const { details: cleanDetails, pickupAddress, refundUpiId } = splitReturnDetails(r.details)
          return (
            <li key={r.id} className={styles.requestCard}>
              <div className={styles.requestTopRow}>
                <div className={styles.requestBadges}>
                  <span className={cn(styles.requestStatusPill, TONES[meta.tone])}>{meta.label}</span>
                  <span

                    className={cn(
                      styles.resolutionPill,
                      isExchange
                        ? styles.resolutionExchange
                        : styles.resolutionRefund
                    )}
                  >
                    {isExchange ? (
                      <>
                        <ArrowLeftRightIcon className={styles.iconXs} aria-hidden /> {isReplacement ? "Replacement" : "Exchange"}
                      </>
                    ) : (
                      "Refund"
                    )}
                  </span>
                  {isExchange && r.exchangeMode === "doorstep" && (
                    <span className={styles.doorstepPill}>Doorstep swap</span>
                  )}
                </div>
                <span className={styles.requestDate}>{formatDateTime(r.createdAt)}</span>
              </div>
              <div className={styles.actorMetaLine}>
                {r.requestedBy === "admin" ? (
                  <ShieldCheckIcon aria-hidden className={cn(styles.actorMetaIcon, styles.actorMetaIconAdmin)} />
                ) : (
                  <UserIcon aria-hidden className={cn(styles.actorMetaIcon, styles.actorMetaIconCustomer)} />
                )}
                <span>
                  {r.requestedBy === "admin" ? "Requested by admin" : "Requested by customer"}
                  {r.status === "rejected" ? " · Rejected by admin" : r.status === "withdrawn" ? " · Cancelled by customer" : ""}
                </span>
              </div>
              <ul className={styles.requestItems}>
                {r.items.map((i) => (
                  <li key={returnLineKey(i)}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              {isExchange && cleanPref && (
                <p className={styles.exchangeDetailPill}>
                  <span className={styles.boldSpan}>
                    {isReplacement ? "Replacement details: " : "Requested exchange: "}
                  </span>
                  {cleanPref}
                </p>
              )}
              <p className={styles.reasonLine}>
                <span className={styles.mutedSpan}>Reason: </span>
                {r.reason}
                {cleanDetails && <span className={styles.mutedSpan}> — {cleanDetails}</span>}
              </p>
              {pickupAddress && (
                <p className={styles.pickupAddrBanner}>
                  <MapPinIcon className={styles.pickupPinIcon} aria-hidden />
                  <span>
                    <span className={styles.boldSpan}>Alternate pickup address: </span>
                    {pickupAddress}
                  </span>
                </p>
              )}
              {refundUpiId && (
                <p className={styles.pickupAddrBanner}>
                  <WalletIcon className={styles.pickupPinIcon} aria-hidden />
                  <span>
                    <span className={styles.boldSpan}>Customer refund UPI ID: </span>
                    <CopyableReference value={refundUpiId} />
                  </span>
                </p>
              )}
              {r.adminNote && (
                <p className={styles.adminNoteBox}>
                  <span className={styles.boldSpan}>Your note: </span>
                  {r.adminNote}
                </p>
              )}
              {r.status === "approved" && (
                <p className={styles.reasonLine}>
                  <span className={styles.mutedSpan}>{r.exchangeMode === "doorstep" ? "Doorstep exchange: " : "Pickup: "}</span>
                  {r.pickedUpAt ? `successful on ${formatDateTime(r.pickedUpAt)}` : r.pickupDate ? `expected by ${formatDate(r.pickupDate)}` : "date not set"}
                </p>
              )}
              {r.status === "withdrawn" && (
                <p className={styles.withdrawnDate}>
                  Cancelled on {formatDateTime(r.decidedAt ?? r.createdAt)}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

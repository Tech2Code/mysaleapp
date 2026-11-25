"use client"

import { ArrowLeftRightIcon, BanIcon, CheckIcon, Loader2Icon, MapPinIcon, PackageOpenIcon, WalletIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { DateField, TextAreaField } from "@/components/form"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { decideReturnRequest, markReturnPickedUp, undoReturnStep } from "@/features/orders/admin-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { requestStatusMeta, splitReturnDetails, type ReturnStage } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, ReturnRequest } from "@/features/orders/types"
import { buildReturnDecisionMessage, whatsappLink } from "@/features/orders/whatsapp"
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
  orderCode,
  customerName,
  phone,
}: {
  request: ReturnRequest
  approve: boolean
  orderCode: string
  customerName: string
  phone: string
}) {
  const router = useRouter()
  const shop = useStoreSettings()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [pickupDate, setPickupDate] = useState("")
  const [bounds, setBounds] = useState<{ min?: string; max?: string }>({})
  const [pickupError, setPickupError] = useState<string | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      const today = todayIST()
      setBounds({ min: today, max: addDays(today, LIMITS.pickupDays.max) })
    } else {
      setNote("")
      setPickupDate("")
      setPickupError(null)
      setNoteError(null)
    }
  }

  const submit = () => {
    setNoteError(null)
    setPickupError(null)
    if (approve && !pickupDate) {
      setPickupError("Pick the pickup date")
      return
    }
    if (!approve && note.trim().length < 3) {
      setNoteError("Enter the reason for rejecting (at least 3 characters)")
      return
    }
    startTransition(async () => {
      const res = await decideReturnRequest({ requestId: request.id, approve, note: note.trim() || undefined, pickupDate: approve ? pickupDate : undefined })
      if (!res.ok) {
        setPickupError(res.fieldErrors?.pickupDate?.[0] ?? null)
        setNoteError(res.fieldErrors?.note?.[0] ?? null)
        toast.error(res.error)
        return
      }
      const isExchange = request.resolutionType === "exchange"
      const url = whatsappLink(
        `91${phone}`,
        buildReturnDecisionMessage(shop, {
          orderCode,
          customerName,
          approved: approve,
          note: note.trim() || null,
          pickupDate: approve ? pickupDate : null,
          resolutionType: request.resolutionType,
          exchangePreference: request.exchangePreference,
        })
      )
      later(() => {
        setOpen(false)
        setNote("")
        setPickupDate("")
        setPickupError(null)
        setNoteError(null)
        toast.success(approve ? (isExchange ? "Exchange approved" : "Return approved") : isExchange ? "Exchange rejected" : "Return rejected", {
          action: { label: "Tell customer on WhatsApp", onClick: () => window.open(url, "_blank", "noopener") },
        })
      })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={cn(
          styles.decideTrigger,
          approve ? styles.decideTriggerApprove : styles.decideTriggerReject
        )}
      >
        {approve ? "Approve" : "Reject"}
      </DialogTrigger>
      <DialogContent className={styles.dialogSmMax}>
        <DialogHeader>
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
              ? "Choose the day the items will be picked up. The customer sees the date and your note on their order page."
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
          {approve && (
            <DateField
              label="Pickup date *"
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
            error={
              noteError ??
              (!approve && note.trim().length > 0 && note.trim().length < 3
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
            {approve ? (request.resolutionType === "exchange" ? "Approve exchange" : "Approve return") : request.resolutionType === "exchange" ? "Reject exchange" : "Reject return"}
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
  admin?: { items: OrderItem[]; paymentStatus: string; refundedAmount: number; discountAmount?: number }
}) {
  if (requests.length === 0 && returns.length === 0) return null
  return (
    <section id="returns" aria-label="Returns" className={styles.returnsSection}>
      <div className={styles.returnsHeader}>
        <h2 className={styles.returnsHeading}>
          <PackageOpenIcon className={styles.returnsIcon} aria-hidden /> Returns
        </h2>
        <ReturnStageBadge stage={returnStage} audience="admin" alwaysShow />
      </div>
      {/* Newest stage first: goods received back (the later stage) above the requests. */}
      <ReturnsList bare returns={returns.toReversed()} audience="admin" admin={admin} />
      {requests.length > 0 && <h4 className={styles.requestsSubheading}>Return requests</h4>}
      <ul className={requests.length === 0 ? styles.requestsListHidden : styles.requestsList}>
        {requests.toReversed().map((r) => {
          const meta = requestStatusMeta(r.status, "admin", r.resolutionType)
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
                </div>
                <span className={styles.requestDate}>{formatDateTime(r.createdAt)}</span>
              </div>
              <ul className={styles.requestItems}>
                {r.items.map((i) => (
                  <li key={i.productId}>
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
                  <span className={styles.mutedSpan}>Pickup: </span>
                  {r.pickedUpAt ? `successful on ${formatDateTime(r.pickedUpAt)}` : r.pickupDate ? `scheduled for ${formatDate(r.pickupDate)}` : "date not set"}
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

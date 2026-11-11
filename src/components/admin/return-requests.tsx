"use client"

import { BanIcon, CheckIcon, Loader2Icon, PackageOpenIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { DateField, TextAreaField } from "@/components/form"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { decideReturnRequest, markReturnPickedUp, undoReturnStep } from "@/features/orders/admin-actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { requestStatusMeta, type ReturnStage } from "@/features/orders/returns"
import type { OrderReturn, ReturnRequest } from "@/features/orders/types"
import { buildReturnDecisionMessage, whatsappLink } from "@/features/orders/whatsapp"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TONES } from "@/components/shared/status-badge"
import { ReturnStageBadge } from "@/components/shared/return-stage-badge"
import { ReturnsList } from "@/components/shared/returns-list"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { LIMITS, addDays, todayIST } from "@/lib/validation"

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
  const [error, setError] = useState<string | null>(null)
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
      setError(null)
    }
  }

  const submit = () => {
    setError(null)
    setPickupError(null)
    if (approve && !pickupDate) {
      setPickupError("Pick the pickup date")
      return
    }
    if (!approve && !note.trim()) {
      setError("Enter the reason for rejecting")
      return
    }
    startTransition(async () => {
      const res = await decideReturnRequest({ requestId: request.id, approve, note: note.trim() || undefined, pickupDate: approve ? pickupDate : undefined })
      if (!res.ok) {
        setPickupError(res.fieldErrors?.pickupDate?.[0] ?? null)
        setError(res.fieldErrors?.note?.[0] ?? (res.fieldErrors?.pickupDate ? null : res.error))
        return
      }
      const url = whatsappLink(`91${phone}`, buildReturnDecisionMessage(shop, { orderCode, customerName, approved: approve, note: note.trim() || null, pickupDate: approve ? pickupDate : null }))
      later(() => {
        setOpen(false)
        setNote("")
        setPickupDate("")
        toast.success(approve ? "Return approved" : "Return rejected", {
          action: { label: "Tell customer on WhatsApp", onClick: () => window.open(url, "_blank", "noopener") },
        })
      })
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger data-ui="admin/DecideDialog/DialogTrigger"
        className={cn(
          "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
          approve ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-destructive/40 text-destructive hover:bg-destructive/10"
        )}
      >
        {approve ? "Approve" : "Reject"}
      </DialogTrigger>
      <DialogContent data-ui="admin/DecideDialog/DialogContent" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve this return?" : "Reject this return?"}</DialogTitle>
          <DialogDescription>
            {approve
              ? "Choose the day the items will be picked up. The customer sees the date and your note on their order page."
              : "The customer will see your reason on their order page. Be specific and polite."}
          </DialogDescription>
        </DialogHeader>
        {approve && (
          <DateField
            label="Pickup date"
            fieldSize="md"
            min={bounds.min}
            max={bounds.max}
            value={pickupDate}
            onChange={setPickupDate}
            error={pickupError ?? undefined}
          />
        )}
        <TextAreaField
          label={approve ? "Note for the customer (optional)" : "Reason (required)"}
          required={!approve}
          rows={3}
          maxLength={LIMITS.returnDetail.max}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={error ?? undefined}
        />
        <DialogFooter>
          <Button data-ui="admin/DecideDialog/Button-cancel" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <XIcon className="size-4" /> Cancel
          </Button>
          <Button data-ui="admin/DecideDialog/Button" type="button" variant={approve ? "default" : "destructive"} onClick={submit} disabled={pending} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : approve ? <CheckIcon className="size-4" /> : <BanIcon className="size-4" />} {approve ? "Approve return" : "Reject return"}
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
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const confirm = () =>
    startTransition(async () => {
      setError(null)
      const res = await markReturnPickedUp({ requestId })
      if (!res.ok) {
        setError(res.error)
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
        data-ui="admin/PickedUpButton/Button-pickup-successful"
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="rounded-full border-primary/40 text-primary hover:bg-primary/10"
      >
        Pickup successful
      </Button>
      {error && !open && <p data-ui="admin/PickedUpButton/p" role="alert" className="text-sm text-destructive">{error}</p>}
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setError(null)
        }}
        title="Mark the pickup as successful?"
        description={error ? `The customer will see that their items were collected. Do this only after the courier has the parcel. (${error})` : "The customer will see that their items were collected. Do this only after the courier has the parcel."}
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
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const confirm = () =>
    startTransition(async () => {
      setError(null)
      const res = await undoReturnStep({ requestId })
      if (!res.ok) {
        setError(res.error)
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
      <Button data-ui="admin/UndoStepButton/Button-undo-this-step" type="button" variant="outline" onClick={() => setOpen(true)} className="rounded-full">
        Undo this step
      </Button>
      {error && !open && <p data-ui="admin/UndoStepButton/p" role="alert" className="text-sm text-destructive">{error}</p>}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={error ? `${description} (${error})` : description}
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
}: {
  requests: ReturnRequest[]
  returns: OrderReturn[]
  returnStage: ReturnStage | null
}) {
  if (requests.length === 0 && returns.length === 0) return null
  return (
    <section data-ui="admin/AdminReturnRequests" id="returns" aria-label="Returns" className="scroll-mt-24 space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <div data-ui="admin/AdminReturnRequests/div-flex" className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 data-ui="admin/AdminReturnRequests/h2-returns" className="flex items-center gap-2 font-sans text-lg font-semibold">
          <PackageOpenIcon className="size-5 text-primary" aria-hidden /> Returns
        </h2>
        <ReturnStageBadge stage={returnStage} audience="admin" alwaysShow />
      </div>
      {/* Newest stage first: goods received back (the later stage) above the requests. */}
      <ReturnsList bare returns={[...returns].reverse()} audience="admin" />
      {requests.length > 0 && <h4 data-ui="admin/AdminReturnRequests/h4-return-requests" className="text-sm font-semibold text-muted-foreground">Return requests</h4>}
      <ul data-ui="admin/AdminReturnRequests/ul" className={requests.length === 0 ? "hidden" : "space-y-3"}>
        {[...requests].reverse().map((r) => {
          const meta = requestStatusMeta(r.status, "admin")
          return (
            <li data-ui="admin/AdminReturnRequests/li" key={r.id} className="space-y-2.5 rounded-xl border p-4">
              <div data-ui="admin/AdminReturnRequests/div-flex-2" className="flex flex-wrap items-center justify-between gap-2">
                <span data-ui="admin/AdminReturnRequests/span" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONES[meta.tone])}>{meta.label}</span>
                <span data-ui="admin/AdminReturnRequests/span-2" className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
              <ul data-ui="admin/AdminReturnRequests/ul-2" className="space-y-0.5 text-sm font-medium">
                {r.items.map((i) => (
                  <li data-ui="admin/AdminReturnRequests/li-2" key={i.productId}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              <p data-ui="admin/AdminReturnRequests/p" className="text-sm">
                <span data-ui="admin/AdminReturnRequests/span-3" className="text-muted-foreground">Reason: </span>
                {r.reason}
                {r.details && <span data-ui="admin/AdminReturnRequests/span-4" className="text-muted-foreground"> — {r.details}</span>}
              </p>
              {r.adminNote && (
                <p data-ui="admin/AdminReturnRequests/p-2" className="rounded-lg bg-muted/60 p-3 text-sm">
                  <span data-ui="admin/AdminReturnRequests/span-5" className="font-semibold">Your note: </span>
                  {r.adminNote}
                </p>
              )}
              {r.status === "approved" && (
                <p data-ui="admin/AdminReturnRequests/p-3" className="text-sm">
                  <span data-ui="admin/AdminReturnRequests/span-6" className="text-muted-foreground">Pickup: </span>
                  {r.pickedUpAt ? `successful on ${formatDateTime(r.pickedUpAt)}` : r.pickupDate ? `scheduled for ${formatDate(r.pickupDate)}` : "date not set"}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

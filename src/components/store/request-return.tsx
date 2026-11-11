"use client"

import { CheckIcon, Loader2Icon, PackageOpenIcon, SendIcon, Undo2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { requestReturn, withdrawReturnRequest } from "@/features/orders/actions"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { isOpenRequest, RETURN_REASONS, requestStatusMeta, returnableQuantities } from "@/features/orders/returns"
import { ReturnsList } from "@/components/shared/returns-list"
import { notRefundedCharges, refundLines } from "@/features/orders/refund"
import type { OrderFee, OrderItem, OrderReturn, OrderStatus, ReturnRequest } from "@/features/orders/types"
import { formatDate, formatDateTime, formatPrice, normalizeIndianPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TONES } from "@/components/shared/status-badge"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"
import { LIMITS } from "@/lib/validation"

type Window = { open: boolean; until: string | null; days: number }

/**
 * "Request a return" for a delivered order. Shown only while the return window is open and something
 * is still returnable. After that it points to WhatsApp. The shop approves or rejects the request.
 */
export function RequestReturn({
  orderCode,
  phoneLast4,
  status,
  items,
  returns,
  requests,
  window: win,
  whatsappUrl,
  onDone,
  charges,
}: {
  /** Delivery + extra charges of the order: shown as "not refunded" in the refund estimate. */
  charges?: { shippingFee: number; extraFees: OrderFee[] }
  orderCode: string
  phoneLast4?: string
  status: OrderStatus
  items: OrderItem[]
  returns: OrderReturn[]
  requests: ReturnRequest[]
  window: Window
  whatsappUrl: string
  onDone?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<string>(RETURN_REASONS[0])
  const [details, setDetails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  useRevealOnChange(requests.map((r) => `${r.id}:${r.status}`).join(","))

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

  // One line with exactly one piece left: nothing to choose, so start at 1 (the customer can still clear it).
  const qtyOf = (id: string) => qty[id] ?? (lines.length === 1 && (left.get(id) ?? 0) === 1 ? "1" : "")

  if (status !== "delivered" || win.days <= 0) return null
  if (requests.some(isOpenRequest) || lines.length === 0) return null

  if (!win.open) {
    return (
      <p data-ui="store/RequestReturn" className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
        The {win.days}-day return window for this order has ended{win.until ? ` (${formatDate(win.until)})` : ""}. If something is wrong with your order,{" "}
        <a data-ui="store/RequestReturn/a-message-us-on-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
          message us on WhatsApp
        </a>
        .
      </p>
    )
  }

  const payload = lines
    .map((i) => ({ productId: i.productId, quantity: Number(qtyOf(i.productId)) || 0 }))
    .filter((i) => i.quantity > 0)
  const estimate = refundLines(items, payload.map((p) => ({ ...p, name: items.find((o) => o.productId === p.productId)?.name ?? "" })))
  const estimateTotal = estimate.reduce((n, l) => n + l.amount, 0)
  const kept = charges ? notRefundedCharges(charges) : []
  const needsDetail = otherNeedsDetail(reason, details)
  const tooMany = payload.some((p) => p.quantity > (left.get(p.productId) ?? 0))

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await requestReturn({ code: orderCode, phoneLast4, items: payload, reason, details: details.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      later(() => {
        setOpen(false)
        setQty({})
        setDetails("")
        toast.success("Return request sent. We'll review it and update you here.")
      })
      onDone?.()
      router.refresh()
    })

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setQty({})
      setReason(RETURN_REASONS[0])
      setDetails("")
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        data-ui="store/RequestReturn/DialogTrigger-inline-flex"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border px-6 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <Undo2Icon className="size-4" aria-hidden /> Request a return
      </DialogTrigger>
      <DialogContent data-ui="store/RequestReturn/DialogContent" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return items from {orderCode}</DialogTitle>
          <DialogDescription>
            Choose what you want to send back. We&apos;ll review your request and tell you how to return it.
            {win.until ? ` You can request a return until ${formatDate(win.until)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <ul data-ui="store/RequestReturn/ul" className="space-y-3">
          {lines.map((i) => {
            const max = left.get(i.productId) ?? 0
            return (
              <li data-ui="store/RequestReturn/li-grid" key={i.productId} className="grid items-start gap-x-4 gap-y-1 rounded-xl border p-3 sm:grid-cols-[1fr_7rem]">
                <p data-ui="store/RequestReturn/p" className="text-sm font-medium sm:pt-1">{i.name}</p>
                <TextField
                  label={`Qty (max ${max})`}
                  kind="digits"
                  fieldSize="md"
                  inputMode="numeric"
                  maxLength={String(LIMITS.returnQuantity.max).length}
                  placeholder="0"
                  value={qtyOf(i.productId)}
                  onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                  error={Number(qtyOf(i.productId)) > max ? `At most ${max}` : undefined}
                />
              </li>
            )
          })}
        </ul>

        {estimate.length > 0 && (
          <div data-ui="store/RequestReturn/div" className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
            <p data-ui="store/RequestReturn/p-flex" className="flex items-baseline justify-between gap-3 font-semibold">
              <span data-ui="store/RequestReturn/span">You will get back</span>
              <span data-ui="store/RequestReturn/span-2">{formatPrice(estimateTotal)}</span>
            </p>
            <p data-ui="store/RequestReturn/p-2" className="text-xs text-muted-foreground">
              Price of the items you return.{kept.length > 0 ? ` Delivery and other charges (${formatPrice(kept.reduce((n, c) => n + c.amount, 0))}) are not refunded.` : " Delivery and other charges are not refunded."}
            </p>
          </div>
        )}
        <SelectField
          label="Why are you returning it?"
          fieldSize="md"
          value={reason}
          onValueChange={setReason}
          options={RETURN_REASONS.map((r) => ({ value: r, label: r }))}
        />
        <TextAreaField
          label={reason === OTHER_REASON ? "Please tell us the reason" : "Tell us more (optional)"}
          required={reason === OTHER_REASON}
          rows={2}
          maxLength={LIMITS.returnDetail.max}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          hint="For damaged items, describe what happened."
          error={needsDetail && details.trim() ? OTHER_DETAIL_MESSAGE : undefined}
        />
        {error && (
          <p data-ui="store/RequestReturn/p-3" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button data-ui="store/RequestReturn/Button-close" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <XIcon className="size-4" /> Close
          </Button>
          <Button data-ui="store/RequestReturn/Button-send-request" type="button" onClick={submit} disabled={pending || payload.length === 0 || tooMany || needsDetail} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon className="size-4" />} Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The customer's return requests and where each one stands. A request can be withdrawn until it is reviewed. */
export function ReturnRequestsPanel({
  requests,
  orderCode,
  phoneLast4,
  onChanged,
  returns = [],
  refundedInFull = false,
}: {
  requests: ReturnRequest[]
  /** Goods already received back: shown in the same card, under the requests. */
  returns?: OrderReturn[]
  refundedInFull?: boolean
  orderCode: string
  phoneLast4?: string
  onChanged?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [phone, setPhone] = useState("")
  const later = useToastAfter(pending)
  useBlockWhile(pending)
  if (requests.length === 0) return <ReturnsList returns={returns} audience="customer" refundedInFull={refundedInFull} />

  // Guests on /track pass phoneLast4 and must prove their full 10-digit mobile number to withdraw;
  // signed-in owners on /account/orders/[code] omit phoneLast4 and are recognised by their session.
  const isGuest = phoneLast4 !== undefined
  const phoneDigits = normalizeIndianPhone(phone)
  const phoneError =
    isGuest && phone.trim() && !phoneDigits
      ? "Enter your 10-digit mobile number"
      : isGuest && phoneDigits && !phoneDigits.endsWith(phoneLast4)
        ? "Doesn't match the number you looked up"
        : undefined
  const phoneMissing = isGuest && (!phoneDigits || Boolean(phoneError))

  const closeConfirm = () => {
    setConfirmId(null)
    setPhone("")
  }

  const withdraw = (id: string) =>
    startTransition(async () => {
      const res = await withdrawReturnRequest({
        code: orderCode,
        phoneLast4,
        phone: isGuest ? phoneDigits ?? undefined : undefined,
        requestId: id,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        closeConfirm()
        toast.success("Return request withdrawn")
      })
      onChanged?.()
      router.refresh()
    })

  return (
    <section data-ui="store/ReturnRequestsPanel" aria-label="Return requests" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 data-ui="store/ReturnRequestsPanel/h3-returns" className="flex items-center gap-2 font-sans text-base font-semibold">
        <PackageOpenIcon className="size-4 text-primary" aria-hidden /> Returns
      </h3>
      {/* Newest stage first: goods received back above the requests. */}
      <ReturnsList bare returns={[...returns].reverse()} audience="customer" refundedInFull={refundedInFull} />
      <h4 data-ui="store/ReturnRequestsPanel/h4-return-requests" className="text-sm font-semibold text-muted-foreground">Return requests</h4>
      <ul data-ui="store/ReturnRequestsPanel/ul" className="space-y-3">
        {[...requests].reverse().map((r) => {
          const meta = requestStatusMeta(r.status, "customer")
          return (
            <li data-ui="store/ReturnRequestsPanel/li" key={r.id} className="space-y-2 rounded-xl border p-3.5">
              <div data-ui="store/ReturnRequestsPanel/div-flex" className="flex flex-wrap items-center justify-between gap-2">
                <span data-ui="store/ReturnRequestsPanel/span" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONES[meta.tone])}>{meta.label}</span>
                <span data-ui="store/ReturnRequestsPanel/span-2" className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
              <ul data-ui="store/ReturnRequestsPanel/ul-2" className="space-y-0.5 text-sm">
                {r.items.map((i) => (
                  <li data-ui="store/ReturnRequestsPanel/li-2" key={i.productId}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              <p data-ui="store/ReturnRequestsPanel/p" className="text-sm text-muted-foreground">
                Reason: {r.reason}
                {r.details ? ` — ${r.details}` : ""}
              </p>
              {r.adminNote && (
                <p data-ui="store/ReturnRequestsPanel/p-2" className="rounded-lg bg-muted/60 p-3 text-sm">
                  <span data-ui="store/ReturnRequestsPanel/span-3" className="font-semibold">{r.status === "rejected" ? "Why: " : "From the shop: "}</span>
                  {r.adminNote}
                </p>
              )}
              {r.status === "approved" && (
                <p data-ui="store/ReturnRequestsPanel/p-3" className="text-xs text-muted-foreground">{r.pickedUpAt ? "Pickup successful. Once the items reach us and are checked, your refund is processed." : r.pickupDate ? `Pickup scheduled for ${formatDate(r.pickupDate)}. Keep the items packed and ready.` : "Send the items back as described above. Once they reach us and are checked, your refund is processed."}</p>
              )}
              {r.status === "requested" && (
                <Button data-ui="store/ReturnRequestsPanel/Button-withdraw-request" type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirmId(r.id)} className="rounded-full">
                  {pending && <Loader2Icon className="animate-spin" />} Withdraw request
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && !pending && closeConfirm()}>
        <DialogContent data-ui="store/ReturnRequestsPanel/DialogContent" className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw this return request?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              We will not review it any further. You can send a new request while the return window is open.
            </DialogDescription>
            {isGuest && (
              <TextField
                label="Your full mobile number"
                kind="phone"
                leading="+91"
                hint="Confirm the whole number you ordered with to withdraw this request."
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={phoneError}
              />
            )}
          </div>
          <DialogFooter>
            <Button data-ui="store/ReturnRequestsPanel/Button-keep-request" type="button" variant="outline" onClick={closeConfirm} disabled={pending} className="gap-1.5 rounded-full">
              <CheckIcon className="size-4" /> Keep request
            </Button>
            <Button data-ui="store/ReturnRequestsPanel/Button-withdraw-request-2" type="button" variant="destructive" disabled={pending || phoneMissing} onClick={() => confirmId && withdraw(confirmId)} className="gap-1.5 rounded-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <Undo2Icon className="size-4" />} Withdraw request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

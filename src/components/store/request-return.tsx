"use client"

import { Loader2Icon, PackageOpenIcon, Undo2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { requestReturn, withdrawReturnRequest } from "@/features/orders/actions"
import { isOpenRequest, RETURN_REASONS, RETURN_STATUS_META, returnableQuantities } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, OrderStatus, ReturnRequest } from "@/features/orders/types"
import { formatDate, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"

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
}: {
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

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

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
    .map((i) => ({ productId: i.productId, quantity: Number(qty[i.productId]) || 0 }))
    .filter((i) => i.quantity > 0)
  const tooMany = payload.some((p) => p.quantity > (left.get(p.productId) ?? 0))

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await requestReturn({ code: orderCode, phoneLast4, items: payload, reason, details: details.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setQty({})
      setDetails("")
      toast.success("Return request sent. We'll review it and update you here.")
      onDone?.()
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
                  maxLength={3}
                  placeholder="0"
                  value={qty[i.productId] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                  error={Number(qty[i.productId]) > max ? `At most ${max}` : undefined}
                />
              </li>
            )
          })}
        </ul>

        <SelectField
          label="Why are you returning it?"
          fieldSize="md"
          value={reason}
          onValueChange={setReason}
          options={RETURN_REASONS.map((r) => ({ value: r, label: r }))}
        />
        <TextAreaField
          label="Tell us more (optional)"
          rows={2}
          maxLength={300}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          hint="For damaged items, describe what happened."
        />
        {error && (
          <p data-ui="store/RequestReturn/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button data-ui="store/RequestReturn/Button-close" type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Close
          </Button>
          <Button data-ui="store/RequestReturn/Button-send-request" type="button" onClick={submit} disabled={pending || payload.length === 0 || tooMany} className="rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const TONE: Record<"info" | "success" | "danger" | "neutral", string> = {
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  neutral: "bg-muted text-muted-foreground",
}

/** The customer's return requests and where each one stands. A request can be withdrawn until it is reviewed. */
export function ReturnRequestsPanel({
  requests,
  orderCode,
  phoneLast4,
  onChanged,
}: {
  requests: ReturnRequest[]
  orderCode: string
  phoneLast4?: string
  onChanged?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  if (requests.length === 0) return null

  const withdraw = (id: string) =>
    startTransition(async () => {
      const res = await withdrawReturnRequest({ code: orderCode, phoneLast4, requestId: id })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Return request withdrawn")
      onChanged?.()
      router.refresh()
    })

  return (
    <section data-ui="store/ReturnRequestsPanel" aria-label="Return requests" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 data-ui="store/ReturnRequestsPanel/h3-return-requests" className="flex items-center gap-2 font-sans text-base font-semibold">
        <PackageOpenIcon className="size-4 text-primary" aria-hidden /> Return requests
      </h3>
      <ul data-ui="store/ReturnRequestsPanel/ul" className="space-y-3">
        {[...requests].reverse().map((r) => {
          const meta = RETURN_STATUS_META[r.status]
          return (
            <li data-ui="store/ReturnRequestsPanel/li" key={r.id} className="space-y-2 rounded-xl border p-3.5">
              <div data-ui="store/ReturnRequestsPanel/div-flex" className="flex flex-wrap items-center justify-between gap-2">
                <span data-ui="store/ReturnRequestsPanel/span" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONE[meta.tone])}>{meta.label}</span>
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
                <p data-ui="store/ReturnRequestsPanel/p-3" className="text-xs text-muted-foreground">Send the items back as described above. Once they reach us and are checked, your refund is processed.</p>
              )}
              {r.status === "requested" && (
                <Button data-ui="store/ReturnRequestsPanel/Button-withdraw-request" type="button" variant="outline" size="sm" disabled={pending} onClick={() => withdraw(r.id)} className="rounded-full">
                  {pending && <Loader2Icon className="animate-spin" />} Withdraw request
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

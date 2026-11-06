"use client"

import { Loader2Icon, PackageOpenIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { TextAreaField } from "@/components/form"
import { AdminReturnOrder } from "@/components/admin/return-order"
import { useStoreSettings } from "@/components/store/store-settings-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { decideReturnRequest } from "@/features/orders/admin-actions"
import { isOpenRequest, RETURN_STATUS_META } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, OrderStatus, PaymentStatus, ReturnRequest } from "@/features/orders/types"
import { buildReturnDecisionMessage, whatsappLink } from "@/features/orders/whatsapp"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"

const TONE = {
  info: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  danger: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  neutral: "bg-muted text-muted-foreground",
} as const

/** Approve (with instructions) or reject (with a reason) one pending request. */
function DecideDialog({
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
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await decideReturnRequest({ requestId: request.id, approve, note: note.trim() || undefined })
      if (!res.ok) {
        setError(res.fieldErrors?.note?.[0] ?? res.error)
        return
      }
      setOpen(false)
      const url = whatsappLink(`91${phone}`, buildReturnDecisionMessage(shop, { orderCode, customerName, approved: approve, note: note.trim() || null }))
      toast.success(approve ? "Return approved" : "Return rejected", {
        action: { label: "Tell customer on WhatsApp", onClick: () => window.open(url, "_blank", "noopener") },
      })
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger data-ui="admin/DecideDialog/DialogTrigger"
        className={cn(
          "inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors",
          approve ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-destructive/40 text-destructive hover:bg-destructive/10"
        )}
      >
        {approve ? "Approve" : "Reject"}
      </DialogTrigger>
      <DialogContent data-ui="admin/DecideDialog/DialogContent">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve this return?" : "Reject this return?"}</DialogTitle>
          <DialogDescription>
            {approve
              ? "The customer will see your instructions on their order page. Tell them how to send the items back (courier address, or that you'll arrange pickup)."
              : "The customer will see your reason on their order page. Be specific and polite."}
          </DialogDescription>
        </DialogHeader>
        <TextAreaField
          label={approve ? "Instructions for the customer (optional)" : "Reason (required)"}
          rows={3}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={error ?? undefined}
        />
        <DialogFooter>
          <Button data-ui="admin/DecideDialog/Button-cancel" type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Cancel
          </Button>
          <Button data-ui="admin/DecideDialog/Button" type="button" variant={approve ? "default" : "destructive"} onClick={submit} disabled={pending} className="rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} {approve ? "Approve return" : "Reject return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Customer return requests on the admin order page. */
export function AdminReturnRequests({
  requests,
  orderId,
  orderCode,
  customerName,
  phone,
  status,
  paymentStatus,
  items,
  returns,
}: {
  requests: ReturnRequest[]
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  items: OrderItem[]
  returns: OrderReturn[]
}) {
  if (requests.length === 0) return null
  return (
    <section data-ui="admin/AdminReturnRequests" aria-label="Return requests" className="space-y-3 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 data-ui="admin/AdminReturnRequests/h2-return-requests" className="flex items-center gap-2 font-sans text-lg font-semibold">
        <PackageOpenIcon className="size-5 text-primary" aria-hidden /> Return requests
      </h2>
      <ul data-ui="admin/AdminReturnRequests/ul" className="space-y-3">
        {[...requests].reverse().map((r) => {
          const meta = RETURN_STATUS_META[r.status]
          return (
            <li data-ui="admin/AdminReturnRequests/li" key={r.id} className="space-y-2.5 rounded-xl border p-4">
              <div data-ui="admin/AdminReturnRequests/div-flex" className="flex flex-wrap items-center justify-between gap-2">
                <span data-ui="admin/AdminReturnRequests/span" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONE[meta.tone])}>{meta.label}</span>
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
              {r.status === "requested" && (
                <div data-ui="admin/AdminReturnRequests/div-flex-2" className="flex flex-wrap gap-2 pt-1">
                  <DecideDialog request={r} approve orderCode={orderCode} customerName={customerName} phone={phone} />
                  <DecideDialog request={r} approve={false} orderCode={orderCode} customerName={customerName} phone={phone} />
                </div>
              )}
              {r.status === "approved" && isOpenRequest(r) && (
                <div data-ui="admin/AdminReturnRequests/div" className="space-y-1.5 pt-1 sm:max-w-xs">
                  <p data-ui="admin/AdminReturnRequests/p-3" className="text-xs text-muted-foreground">When the items arrive, record them here (choose which go back into stock).</p>
                  <AdminReturnOrder
                    orderId={orderId}
                    orderCode={orderCode}
                    status={status}
                    paymentStatus={paymentStatus}
                    items={items}
                    returns={returns}
                    prefill={{ requestId: r.id, items: r.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) }}
                    triggerLabel="Items received: record return"
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

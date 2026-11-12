"use client"

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SwitchField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatPrice } from "@/lib/format"
import { recordOrderReturn } from "@/features/orders/admin-actions"
import { returnableQuantities } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, OrderStatus, PaymentStatus } from "@/features/orders/types"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { LIMITS } from "@/lib/validation"

type Row = { qty: string; restock: boolean }

/**
 * "Record a return" for a delivered order: pick what came back and, per item, whether it can be sold again.
 * Only resellable items go back into stock; damaged ones don't.
 */
export function AdminReturnOrder({
  orderId,
  orderCode,
  status,
  paymentStatus,
  items,
  returns,
  prefill,
  triggerLabel = "Record a return",
}: {
  /** From an approved customer request: its items are filled in and the request is closed when saved. */
  prefill?: { requestId: string; items: { productId: string; quantity: number }[] }
  triggerLabel?: string
  orderId: string
  orderCode: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  items: OrderItem[]
  returns: OrderReturn[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries((prefill?.items ?? []).map((i) => [i.productId, { qty: String(i.quantity), restock: true } satisfies Row]))
  )
  const [reason, setReason] = useState("")
  const [refund, setRefund] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const left = useMemo(() => returnableQuantities(items, returns),[items, returns])
  // one line per product (an order can list a product once, but be safe)
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter(
      (i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0 && (!prefill || prefill.items.some((p) => p.productId === i.productId)),
    )
  }, [items, left, prefill])
  // From a customer request only the requested items, and no more than the requested quantity, can come back.
  const maxOf = (productId: string) => {
    const returnable = left.get(productId) ?? 0
    const asked = prefill?.items.find((p) => p.productId === productId)?.quantity
    return asked === undefined ? returnable : Math.min(returnable, asked)
  }

  if (status !== "delivered") return null
  if (lines.length === 0) {
    // Nothing left to take back. Only say so when something was actually returned (not in the request-prefill dialog).
    return returns.length > 0 && !prefill ? (
      <p data-ui="admin/AdminReturnOrder" className="text-sm text-muted-foreground">Everything was returned.</p>
    ) : null
  }

  const rowOf = (id: string): Row => rows[id] ?? { qty: "", restock: true }
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...rowOf(id), ...patch } }))

  const payload = lines
    .map((i) => ({ productId: i.productId, name: i.name, quantity: Number(rowOf(i.productId).qty) || 0, restock: rowOf(i.productId).restock }))
    .filter((i) => i.quantity > 0)

  const reasonMissing = !prefill && reason.trim().length < 3

  const submit = () =>
    startTransition(async () => {
      setError(null)
      if (reasonMissing) {
        setError("Enter the reason for the return (at least 3 characters).")
        return
      }
      const res = await recordOrderReturn({ orderId, items: payload, reason: reason.trim() || undefined, refund, requestId: prefill?.requestId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      const stockNote = res.data.restocked > 0 ? ` ${res.data.restocked} item(s) back in stock.` : ""
      const refundNote = !refund
        ? ""
        : res.data.fullyRefunded
          ? " Payment marked refunded."
          : ` Partly refunded (${formatPrice(res.data.refundedAmount)} so far); the order stays paid until every item is refunded.`
      later(() => {
        setOpen(false)
        setRows({})
        setReason("")
        setRefund(false)
        toast.success(`Return recorded.${stockNote}${refundNote}`)
      })
      router.refresh()
    })

  const defaultRows = () =>
    Object.fromEntries((prefill?.items ?? []).map((i) => [i.productId, { qty: String(i.quantity), restock: true } satisfies Row]))

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      setRows(defaultRows())
    } else {
      setRows({})
      setReason("")
      setRefund(false)
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        data-ui="admin/AdminReturnOrder/DialogTrigger-inline-flex"
        className="inline-flex h-9 w-full items-center justify-center rounded-full border text-sm font-semibold transition-colors hover:bg-muted"
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent data-ui="admin/AdminReturnOrder/DialogContent" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return for {orderCode}</DialogTitle>
          <DialogDescription>{prefill ? "Only the items the customer asked to return are listed. " : ""}Enter how many came back. Turn off &ldquo;Back into stock&rdquo; for anything damaged.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <ul data-ui="admin/AdminReturnOrder/ul" className="space-y-4">
            {lines.map((i) => {
              const max = maxOf(i.productId)
              const row = rowOf(i.productId)
              const over = Number(row.qty) > max
              return (
                <li data-ui="admin/AdminReturnOrder/li" key={i.productId} className="space-y-2 rounded-xl border p-3">
                  <p data-ui="admin/AdminReturnOrder/p" className="text-sm font-medium">{i.name}</p>
                  <div data-ui="admin/AdminReturnOrder/div-grid" className="grid items-start gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
                    <TextField
                      label={`Returned (max ${max})`}
                      kind="digits"
                      fieldSize="md"
                      inputMode="numeric"
                      maxLength={String(LIMITS.returnQuantity.max).length}
                      value={row.qty}
                      onChange={(e) => setRow(i.productId, { qty: e.target.value })}
                      error={over ? `At most ${max}` : undefined}
                    />
                    <div data-ui="admin/AdminReturnOrder/div" className="sm:pt-6">
                      <SwitchField
                        label="Back into stock"
                        description="Resellable condition"
                        checked={row.restock}
                        onCheckedChange={(v) => setRow(i.productId, { restock: v })}
                      />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <TextAreaField
            label={prefill ? "Reason / note (optional)" : "Reason (required)"}
            required={!prefill}
            rows={2}
            maxLength={LIMITS.returnDetail.max}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={prefill ? "Optional note about the returned items" : "Why did these items come back?"}
          />
          {paymentStatus === "paid" && (
            <SwitchField label="I have refunded these items" description={`Turn on once you have sent back ${formatPrice(payload.reduce((n, p) => n + p.quantity * (items.find((i) => i.productId === p.productId)?.price ?? 0), 0))} for them. The payment shows "Refunded" only when every item is refunded.`} checked={refund} onCheckedChange={setRefund} />
          )}
          {error && (
            <p data-ui="admin/AdminReturnOrder/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-ui="admin/AdminReturnOrder/Button-cancel" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <XIcon className="size-4" /> Cancel
          </Button>
          <Button data-ui="admin/AdminReturnOrder/Button-save-return" type="button" onClick={submit} disabled={pending || payload.length === 0 || payload.some((p) => p.quantity > maxOf(p.productId)) || reasonMissing} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon className="size-4" />} Save return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

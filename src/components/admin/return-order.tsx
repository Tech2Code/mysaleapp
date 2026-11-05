"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SwitchField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { recordOrderReturn } from "@/features/orders/admin-actions"
import type { OrderItem, OrderReturn, OrderStatus, PaymentStatus } from "@/features/orders/types"

type Row = { qty: string; restock: boolean }

/** Quantity of each product still returnable = ordered minus what earlier returns already took back. */
function remainingByProduct(items: OrderItem[], returns: OrderReturn[]): Map<string, number> {
  const left = new Map<string, number>()
  for (const i of items) left.set(i.productId, (left.get(i.productId) ?? 0) + i.quantity)
  for (const r of returns) for (const i of r.items) left.set(i.productId, (left.get(i.productId) ?? 0) - i.quantity)
  return left
}

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

  const left = useMemo(() => remainingByProduct(items, returns), [items, returns])
  // one line per product (an order can list a product once, but be safe)
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

  if (status !== "delivered" || lines.length === 0) return null

  const rowOf = (id: string): Row => rows[id] ?? { qty: "", restock: true }
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...rowOf(id), ...patch } }))

  const payload = lines
    .map((i) => ({ productId: i.productId, name: i.name, quantity: Number(rowOf(i.productId).qty) || 0, restock: rowOf(i.productId).restock }))
    .filter((i) => i.quantity > 0)

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const res = await recordOrderReturn({ orderId, items: payload, reason: reason.trim() || undefined, refund, requestId: prefill?.requestId })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setOpen(false)
      setRows({})
      setReason("")
      setRefund(false)
      toast.success(res.data.restocked > 0 ? `Return recorded. ${res.data.restocked} item(s) back in stock.` : "Return recorded")
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        data-ui="admin/AdminReturnOrder/DialogTrigger-inline-flex"
        className="inline-flex h-9 w-full items-center justify-center rounded-full border text-sm font-semibold transition-colors hover:bg-muted"
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent data-ui="admin/AdminReturnOrder/DialogContent" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return for {orderCode}</DialogTitle>
          <DialogDescription>Enter how many came back. Turn off &ldquo;Back into stock&rdquo; for anything damaged.</DialogDescription>
        </DialogHeader>

        <ul data-ui="admin/AdminReturnOrder/ul" className="space-y-4">
          {lines.map((i) => {
            const max = left.get(i.productId) ?? 0
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
                    maxLength={3}
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

        <TextAreaField label="Reason (optional)" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        {paymentStatus === "paid" && (
          <SwitchField label="Mark the payment as refunded" description="Turn on once you have sent the money back" checked={refund} onCheckedChange={setRefund} />
        )}
        {error && (
          <p data-ui="admin/AdminReturnOrder/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button data-ui="admin/AdminReturnOrder/Button-cancel" type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-full">
            Cancel
          </Button>
          <Button data-ui="admin/AdminReturnOrder/Button-save-return" type="button" onClick={submit} disabled={pending || payload.length === 0 || payload.some((p) => p.quantity > (left.get(p.productId) ?? 0))} className="rounded-full">
            {pending && <Loader2Icon className="animate-spin" />} Save return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

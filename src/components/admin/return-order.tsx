"use client"

import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SwitchField, TextAreaField, TextField } from "@/components/form"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { formatPrice } from "@/lib/format"
import { recordOrderReturn } from "@/features/orders/admin-actions"
import { netReturnRefund } from "@/features/orders/refund"
import { returnableQuantities, returnLineKey } from "@/features/orders/returns"
import type { ExchangeMode, OrderItem, OrderReturn, OrderStatus, PaymentStatus, ReturnResolutionType } from "@/features/orders/types"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { LIMITS } from "@/lib/validation"
import styles from "./admin-orders.module.css"

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
  refundedAmount = 0,
  discountAmount = 0,
  paidAmount,
  items,
  returns,
  prefill,
  triggerLabel = "Record a return",
}: {
  /** From an approved customer request: its items are filled in and the request is closed when saved. */
  prefill?: {
    requestId: string
    resolutionType?: ReturnResolutionType
    exchangeMode?: ExchangeMode
    items: { productId: string; variantId?: string | null; quantity: number }[]
  }
  triggerLabel?: string
  orderId: string
  orderCode: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  refundedAmount?: number
  discountAmount?: number
  paidAmount?: number
  items: OrderItem[]
  returns: OrderReturn[]
}) {
  const router = useRouter()
  const isDoorstepExchange = prefill?.resolutionType === "exchange" && prefill?.exchangeMode === "doorstep"
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries((prefill?.items ?? []).map((i) => [returnLineKey(i), { qty: String(i.quantity), restock: true } satisfies Row]))
  )
  const [reason, setReason] = useState("")
  const [refund, setRefund] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reasonTouched, setReasonTouched] = useState(false)
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => {
      const key = returnLineKey(i)
      if (seen.has(key) || (left.get(key) ?? 0) <= 0) return false
      seen.add(key)
      if (!prefill) return true
      return prefill.items.some((p) => (p.variantId ? returnLineKey(p) === key : p.productId === i.productId))
    })
  }, [items, left, prefill])
  // From a customer request only the requested items, and no more than the requested quantity, can come back.
  const maxOf = (line: { productId: string; variantId?: string | null }) => {
    const key = returnLineKey(line)
    const returnable = left.get(key) ?? 0
    const asked = prefill?.items.find((p) => (p.variantId ? returnLineKey(p) === key : p.productId === line.productId))?.quantity
    return asked === undefined ? returnable : Math.min(returnable, asked)
  }

  if (status !== "delivered") return null
  if (lines.length === 0) {
    // Nothing left to take back. Only say so when something was actually returned (not in the request-prefill dialog).
    return returns.length > 0 && !prefill ? (
      <p className={styles.allReturnedNote}>Everything was returned.</p>
    ) : null
  }

  const rowOf = (key: string): Row => rows[key] ?? { qty: "", restock: true }
  const setRow = (key: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [key]: { ...rowOf(key), ...patch } }))

  const payload = lines
    .map((i) => {
      const key = returnLineKey(i)
      return {
        productId: i.productId,
        ...(i.variantId ? { variantId: i.variantId } : {}),
        name: i.name,
        quantity: Number(rowOf(key).qty) || 0,
        restock: rowOf(key).restock,
      }
    })
    .filter((i) => i.quantity > 0)

  const reasonMissing = !prefill && reason.trim().length < 3

  const submit = () => {
    setSubmitted(true)
    setReasonError(null)
    if (payload.length === 0 || payload.some((p) => p.quantity > maxOf(p)) || reasonMissing) {
      if (payload.length === 0 && lines.length > 1) {
        toast.error("Please enter a quantity of at least 1 for the returned item(s).")
      }
      return
    }
    startTransition(async () => {
      const res = await recordOrderReturn({ orderId, items: payload, reason: reason.trim() || undefined, refund, requestId: prefill?.requestId })
      if (!res.ok) {
        if (res.fieldErrors?.reason?.[0]) setReasonError(res.fieldErrors.reason[0])
        toast.error(res.error)
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
        setSubmitted(false)
        setReasonTouched(false)
        setReasonError(null)
        toast.success(isDoorstepExchange ? `Doorstep exchange completed.${stockNote}` : `Return recorded.${stockNote}${refundNote}`)
      })
      router.refresh()
    })
  }

  const defaultRows = () =>
    Object.fromEntries((prefill?.items ?? []).map((i) => [returnLineKey(i), { qty: String(i.quantity), restock: true } satisfies Row]))

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (nextOpen) {
      setRows(defaultRows())
    } else {
      setRows({})
      setReason("")
      setRefund(false)
      setSubmitted(false)
      setReasonTouched(false)
      setReasonError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={buttonVariants({ variant: "outline", fullWidth: true })}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent mobileFullScreen className={styles.dialogLgMax}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>{isDoorstepExchange ? `Complete doorstep exchange — ${orderCode}` : `Return for ${orderCode}`}</DialogTitle>
          <DialogDescription>
            {isDoorstepExchange
              ? "Confirm the old item(s) collected during the doorstep swap. Turn off “Back into stock” if damaged — saving deducts replacement stock and marks the exchange complete."
              : `${prefill ? "Only the items the customer asked to return are listed. " : ""}Enter how many came back. Turn off “Back into stock” for anything damaged.`}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={styles.dialogBodyStack4}>
          <ul className={styles.recordReturnList}>
            {lines.map((i) => {
              const key = returnLineKey(i)
              const max = maxOf(i)
              const row = rowOf(key)
              const over = Number(row.qty) > max
              return (
                <li key={key} className={styles.recordReturnItem}>
                  <p className={styles.recordItemTitle}>{i.name}</p>
                  <div className={styles.recordItemGrid}>
                    <TextField
                      label={`Returned (max ${max})`}
                      kind="digits"
                      fieldSize="md"
                      inputMode="numeric"
                      maxLength={String(LIMITS.returnQuantity.max).length}
                      value={row.qty}
                      onChange={(e) => setRow(key, { qty: e.target.value })}
                      error={
                        over
                          ? `At most ${max}`
                          : submitted && payload.length === 0 && key === returnLineKey(lines[0]!)
                            ? "Enter at least 1"
                            : undefined
                      }
                    />
                    <div className={styles.restockCol}>
                      <SwitchField
                        label="Back into stock"
                        description="Resellable condition"
                        checked={row.restock}
                        onCheckedChange={(v) => setRow(key, { restock: v })}
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
            onChange={(e) => {
              setReason(e.target.value)
              if (reasonError) setReasonError(null)
            }}
            onBlur={() => setReasonTouched(true)}
            placeholder={prefill ? "Optional note about the returned items" : "Why did these items come back?"}
            error={
              reasonError ??
              ((submitted || reasonTouched) && reasonMissing
                ? "Enter the reason for the return (at least 3 characters)"
                : undefined)
            }
          />
          {paymentStatus === "paid" && prefill?.resolutionType !== "exchange" && (
            <SwitchField
              label="I have refunded these items"
              description={`Turn on once you have sent back ${formatPrice(
                netReturnRefund(items, payload, {
                  discountAmount,
                  paidAmount,
                  alreadyRefunded: refundedAmount,
                  priorReturnedLines: returns.filter((r) => r.refunded).flatMap((r) => r.items),
                })
              )} for them. The payment shows "Refunded" only when every item is refunded.`}
              checked={refund}
              onCheckedChange={setRefund}
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtnGap}>
            <XIcon className={styles.iconMd} /> Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending} className={styles.pillBtnGap}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <CheckIcon className={styles.iconMd} />}{" "}
            {isDoorstepExchange ? "Confirm doorstep handover" : "Save return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

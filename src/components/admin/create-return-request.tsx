"use client"

import { Loader2Icon, SendIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createReturnRequestAsAdmin } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, otherNeedsDetail } from "@/features/orders/reasons"
import { RETURN_REASONS, returnableQuantities } from "@/features/orders/returns"
import type { OrderItem, OrderReturn } from "@/features/orders/types"
import { LIMITS } from "@/lib/validation"

/**
 * "Create return request" for a customer who asked outside the app (WhatsApp / phone). It opens a normal request
 * (return window ignored); the admin then approves it from the same status dropdown.
 */
export function CreateReturnRequest({ orderId, orderCode, items, returns }: { orderId: string; orderCode: string; items: OrderItem[]; returns: OrderReturn[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<string>(RETURN_REASONS[0])
  const [details, setDetails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

  const payload = lines.map((i) => ({ productId: i.productId, name: i.name, quantity: Number(qty[i.productId]) || 0 })).filter((i) => i.quantity > 0)
  const over = (id: string) => Number(qty[id]) > (left.get(id) ?? 0)

  const submit = () =>
    startTransition(async () => {
      setError(null)
      setDetailsError(null)
      if (otherNeedsDetail(reason, details)) {
        setDetailsError(OTHER_DETAIL_MESSAGE)
        return
      }
      const res = await createReturnRequestAsAdmin({ orderId, items: payload, reason, details: details.trim() || undefined })
      if (!res.ok) {
        setDetailsError(res.fieldErrors?.details?.[0] ?? null)
        setError(res.error)
        return
      }
      later(() => {
        setOpen(false)
        setQty({})
        setDetails("")
        toast.success("Return request created. Approve it from the status dropdown.")
      })
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
      setDetailsError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger data-ui="admin/CreateReturnRequest/DialogTrigger-inline-flex" className="inline-flex h-9 items-center rounded-full border border-primary/40 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10">
        Create return request
      </DialogTrigger>
      <DialogContent data-ui="admin/CreateReturnRequest/DialogContent" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Return request for {orderCode}</DialogTitle>
          <DialogDescription>For a customer who asked outside the app. The return window is ignored. You approve it next, with a pickup date.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <ul data-ui="admin/CreateReturnRequest/ul" className="space-y-3">
            {lines.map((i) => (
              <li data-ui="admin/CreateReturnRequest/li" key={i.productId} className="space-y-1 rounded-xl border p-3">
                <p data-ui="admin/CreateReturnRequest/p" className="text-sm font-medium">{i.name}</p>
                <TextField
                  label={`How many (max ${left.get(i.productId) ?? 0})`}
                  kind="digits"
                  fieldSize="md"
                  inputMode="numeric"
                  maxLength={String(LIMITS.returnQuantity.max).length}
                  value={qty[i.productId] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                  error={over(i.productId) ? `At most ${left.get(i.productId) ?? 0}` : undefined}
                />
              </li>
            ))}
          </ul>
          <SelectField label="Reason" fieldSize="md" options={RETURN_REASONS.map((r) => ({ value: r, label: r }))} value={reason} onValueChange={setReason} />
          <TextAreaField label="Details (optional)" rows={2} maxLength={LIMITS.returnDetail.max} value={details} onChange={(e) => setDetails(e.target.value)} error={detailsError ?? undefined} />
          {error && !detailsError && (
            <p data-ui="admin/CreateReturnRequest/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{error}</p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button data-ui="admin/CreateReturnRequest/Button-cancel" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
            <XIcon className="size-4" /> Cancel
          </Button>
          <Button data-ui="admin/CreateReturnRequest/Button-create-request" type="button" onClick={submit} disabled={pending || payload.length === 0 || lines.some((i) => over(i.productId))} className="gap-1.5 rounded-full">
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon className="size-4" />} Create request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

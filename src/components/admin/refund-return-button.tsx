"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { refundReturn } from "@/features/orders/admin-actions"
import { formatPrice } from "@/lib/format"

/**
 * "Mark refunded" for ONE return that was recorded without a refund. `value` is only shown (the server prices the
 * return from the order's items); `expectedRefunded` is what this screen showed, so a double click can't refund twice.
 */
export function RefundReturnButton({ returnId, value, expectedRefunded }: { returnId: string; value: number; expectedRefunded: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const run = () =>
    startTransition(async () => {
      const res = await refundReturn({ returnId, expectedRefunded })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success(res.data.fullyRefunded ? "Refund recorded. Payment marked refunded." : `Refund recorded (${formatPrice(res.data.refundedAmount)} refunded so far).`)
      })
      router.refresh()
    })

  return (
    <>
      <Button data-ui="admin/RefundReturnButton/Button-i-have-refunded" type="button" variant="outline" size="sm" disabled={pending} onClick={() => setOpen(true)} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} I have refunded {formatPrice(value)}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Record a refund of ${formatPrice(value)}?`}
        description="Only do this after you have sent the money back to the customer. It marks this return as refunded."
        confirmLabel="Yes, I have refunded"
        pending={pending}
        onConfirm={run}
      />
    </>
  )
}

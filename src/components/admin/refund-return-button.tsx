"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { Button } from "@/components/ui/button"
import { refundReturn } from "@/features/orders/admin-actions"
import { formatPrice } from "@/lib/format"

/**
 * "Mark refunded" for ONE return that was recorded without a refund. `value` is only shown (the server prices the
 * return from the order's items); `expectedRefunded` is what this screen showed, so a double click can't refund twice.
 */
export function RefundReturnButton({ returnId, value, expectedRefunded }: { returnId: string; value: number; expectedRefunded: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)

  const run = () =>
    startTransition(async () => {
      const res = await refundReturn({ returnId, expectedRefunded })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.data.fullyRefunded ? "Refund recorded. Payment marked refunded." : `Refund recorded (${formatPrice(res.data.refundedAmount)} refunded so far).`)
      router.refresh()
    })

  return (
    <Button data-ui="admin/RefundReturnButton" type="button" variant="outline" size="sm" disabled={pending} onClick={run} className="rounded-full">
      {pending && <Loader2Icon className="animate-spin" />} I have refunded {formatPrice(value)}
    </Button>
  )
}

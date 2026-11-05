"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateAdminNote, updateOrderStatus } from "@/features/orders/admin-actions"
import { ORDER_STATUSES, STATUS_META, type OrderStatus } from "@/features/orders/types"
import { buildStatusUpdateMessage, whatsappLink } from "@/features/orders/whatsapp"
import { nativeSelectClass } from "./admin-page-header"

export function OrderStatusControl({
  orderId,
  orderCode,
  customerName,
  phone,
  status,
}: {
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  status: OrderStatus
}) {
  const router = useRouter()
  const [value, setValue] = useState<OrderStatus>(status)
  const [pending, startTransition] = useTransition()
  const changed = value !== status

  const notifyUrl = whatsappLink(
    `91${phone}`,
    buildStatusUpdateMessage({ orderCode, customerName, status: value })
  )

  const save = () =>
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: value })
      if (res.ok) {
        toast.success(`Status changed to ${STATUS_META[value].label}`, {
          action: { label: "Notify on WhatsApp", onClick: () => window.open(notifyUrl, "_blank", "noopener") },
        })
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })

  return (
    <div className="space-y-3">
      <Label htmlFor="order-status" className="text-sm font-medium">
        Order status
      </Label>
      <select
        id="order-status"
        value={value}
        onChange={(e) => setValue(e.target.value as OrderStatus)}
        className={nativeSelectClass}
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_META[s].label}
          </option>
        ))}
      </select>
      <Button onClick={save} disabled={!changed || pending} className="w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Update status
      </Button>
      <a
        href={notifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-9 items-center justify-center gap-2 rounded-full bg-whatsapp text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        <WhatsAppIcon className="size-4" /> Send “{STATUS_META[value].label}” update
      </a>
    </div>
  )
}

export function AdminNoteForm({ orderId, note }: { orderId: string; note: string | null }) {
  const [value, setValue] = useState(note ?? "")
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const res = await updateAdminNote({ orderId, note: value })
          if (res.ok) toast.success("Note saved")
          else toast.error(res.error)
        })
      }}
    >
      <Label htmlFor="admin-note" className="text-sm font-medium">
        Private note
      </Label>
      <Textarea
        id="admin-note"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Payment received via UPI, courier AWB number…"
        maxLength={1000}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending || value === (note ?? "")} className="rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} Save note
      </Button>
    </form>
  )
}

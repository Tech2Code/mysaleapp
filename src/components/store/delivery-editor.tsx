"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, LockIcon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateOrderDelivery } from "@/features/orders/actions"
import { checkoutSchema, type CheckoutInput } from "@/features/orders/schema"
import type { DeliveryDetails } from "@/features/orders/types"
import { LIMITS } from "@/lib/validation"

/**
 * Delivery address of an order. While the order is still pending (not confirmed)
 * the customer can edit it here; afterwards it is locked.
 */
export function DeliveryEditor({
  orderCode,
  delivery,
  editable,
  phoneLast4,
  onChanged,
}: {
  orderCode: string
  delivery: DeliveryDetails
  editable: boolean
  /** Needed for guests (from the track page). Signed-in owners don't need it. */
  phoneLast4?: string
  /** Called after saving, with the (possibly new) last 4 digits of the phone. Defaults to refreshing the page. */
  onChanged?: (newPhoneLast4: string) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    values: {
      name: delivery.name,
      phone: delivery.phone,
      address: delivery.address,
      city: delivery.city,
      pincode: delivery.pincode,
      note: delivery.note ?? "",
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const res = await updateOrderDelivery({ code: orderCode, phoneLast4, customer: values })
      if (!res.ok) {
        setServerError(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof CheckoutInput, { message: messages[0] })
        }
        return
      }
      toast.success("Delivery details updated")
      setOpen(false)
      if (onChanged) onChanged(res.data.phoneLast4)
      else router.refresh()
    })
  })

  return (
    <section data-ui="store/DeliveryEditor" aria-labelledby="delivery-title" className="rounded-3xl border bg-card p-5 text-sm sm:p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id="delivery-title" className="font-sans text-lg font-semibold">
          Delivery address
        </h3>
        {editable && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <PencilIcon /> Edit
          </Button>
        )}
      </div>

      <p className="font-medium">
        {delivery.name} · {delivery.phone}
      </p>
      <p className="text-muted-foreground">
        {delivery.address}, {delivery.city} - {delivery.pincode}
      </p>
      {delivery.note && <p className="mt-2 text-muted-foreground">Note: {delivery.note}</p>}

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        {editable ? (
          "You can change these details until your order is confirmed."
        ) : (
          <>
            <LockIcon className="mt-0.5 size-3.5 shrink-0" />
            Your order is confirmed, so the address is locked. Message us on WhatsApp if something is wrong.
          </>
        )}
      </p>

      {editable && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <form onSubmit={onSubmit} noValidate className="space-y-1.5">
              <DialogHeader>
                <DialogTitle>Edit delivery details</DialogTitle>
                <DialogDescription>Order {orderCode}. You can change this until we confirm the order.</DialogDescription>
              </DialogHeader>
              <TextField label="Full name" kind="personName" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
              <TextField
                label="Mobile number" kind="phone"
                type="tel"
                inputMode="tel"
                leading="+91"
                autoComplete="tel"
                error={errors.phone?.message}
                {...form.register("phone")}
              />
              <TextAreaField label="Full address" maxLength={LIMITS.address.max} rows={3} error={errors.address?.message} {...form.register("address")} />
              <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <TextField label="City" kind="city" error={errors.city?.message} {...form.register("city")} />
                <TextField
                  label="Pincode" kind="pincode"
                  inputMode="numeric"
                  maxLength={6}
                  error={errors.pincode?.message}
                  {...form.register("pincode")}
                />
              </div>
              <TextAreaField label="Note (optional)" maxLength={LIMITS.note.max} rows={2} error={errors.note?.message} {...form.register("note")} />
              {serverError && (
                <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {serverError}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={pending}>
                  {pending && <Loader2Icon className="animate-spin" />} Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

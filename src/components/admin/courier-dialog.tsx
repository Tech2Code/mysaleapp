"use client"

import { Loader2Icon, PencilIcon, TruckIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { DateField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { updateOrderStatus } from "@/features/orders/admin-actions"
import { COURIER_SUGGESTIONS, expectedDeliveryProblem, shippingSchema } from "@/features/orders/schema"
import type { ShippingDetails } from "@/features/orders/types"
import { LIMITS } from "@/lib/validation"

export type CourierPayload = z.output<typeof shippingSchema>
type Values = { carrier: string; trackingNumber: string; trackingUrl: string; expectedDelivery: string }

export const courierValues = (s: ShippingDetails | null | undefined): Values => ({
  carrier: s?.carrier ?? "",
  trackingNumber: s?.trackingNumber ?? "",
  trackingUrl: s?.trackingUrl ?? "",
  expectedDelivery: s?.expectedDelivery ?? "",
})

/**
 * The ONE place courier details are entered: courier, tracking / AWB number, tracking link, expected date.
 * Opened from the order status (when choosing "Shipped") and from the "Edit" button on the shipping card.
 * Validates with the same schema as the server, then hands the clean payload to `onSave`.
 */
export function CourierDialog({
  open,
  onOpenChange,
  initial,
  previousExpected,
  title,
  description,
  saveLabel,
  pending = false,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: Values
  /** The expected date already saved: an unchanged past date is not an error. */
  previousExpected?: string | null
  title: string
  description: string
  saveLabel: string
  pending?: boolean
  onSave: (payload: CourierPayload, values: Values) => void
}) {
  const form = useForm<Values>({ defaultValues: initial })
  const { errors } = form.formState
  const wasOpen = useRef(open)

  useEffect(() => {
    if (open && !wasOpen.current) {
      form.reset(initial)
    }
    wasOpen.current = open
  }, [open, initial, form])

  const submit = form.handleSubmit((values) => {
    const dateProblem = expectedDeliveryProblem(values.expectedDelivery, previousExpected)
    if (dateProblem) {
      form.setError("expectedDelivery", { message: dateProblem })
      return
    }
    const parsed = shippingSchema.safeParse(values)
    if (!parsed.success) {
      for (const [field, messages] of Object.entries(z.flattenError(parsed.error).fieldErrors)) {
        if (messages?.[0]) form.setError(field as keyof Values, { message: messages[0] })
      }
      return
    }
    onSave(parsed.data, values)
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent data-ui="admin/CourierDialog/DialogContent" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form data-ui="admin/CourierDialog/form" onSubmit={submit} noValidate className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <DialogBody className="space-y-2">
            <TextField
              label="Courier"
              maxLength={LIMITS.carrier.max}
              fieldSize="md"
              placeholder="e.g. Delhivery"
              suggestions={COURIER_SUGGESTIONS}
              error={errors.carrier?.message}
              {...form.register("carrier")}
            />
            <TextField
              label="Tracking / AWB number"
              kind="trackingNumber"
              fieldSize="md"
              hint={`Optional. ${LIMITS.trackingNumber.min}-${LIMITS.trackingNumber.max} letters, numbers, - / _ (no spaces).`}
              className="font-mono"
              error={errors.trackingNumber?.message}
              {...form.register("trackingNumber")}
            />
            <TextField
              label="Tracking link"
              kind="url"
              fieldSize="md"
              type="url"
              inputMode="url"
              placeholder="https://…"
              hint="Optional. Customers get a “Track shipment” button."
              error={errors.trackingUrl?.message}
              {...form.register("trackingUrl")}
            />
            <Controller
              control={form.control}
              name="expectedDelivery"
              render={({ field }) => (
                <DateField
                  label="Expected delivery date"
                  fieldSize="md"
                  hint={`Within the next ${LIMITS.expectedDeliveryDays.max} days.`}
                  error={errors.expectedDelivery?.message}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={pending}
                />
              )}
            />
          </DialogBody>
          <DialogFooter>
            <Button data-ui="admin/CourierDialog/Button-cancel" type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending} className="gap-1.5 rounded-full">
              <XIcon className="size-4" /> Cancel
            </Button>
            <Button data-ui="admin/CourierDialog/Button" type="submit" disabled={pending} className="gap-1.5 rounded-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <TruckIcon className="size-4" />} {saveLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** "Edit" button on the shipping card of a SHIPPED order: opens the courier popup and saves the details (status stays shipped). */
export function CourierEditButton({ orderId, shipping }: { orderId: string; shipping: ShippingDetails }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const save = (payload: CourierPayload) =>
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: "shipped", expectedStatus: "shipped", shipping: payload })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Courier details updated")
      })
      router.refresh()
    })

  return (
    <>
      <Button data-ui="admin/CourierEditButton/Button-edit" type="button" variant="outline" size="sm" onClick={() => setOpen(true)} className="h-6 gap-1 rounded-full px-2.5 text-xs">
        <PencilIcon className="size-3" aria-hidden /> Edit
      </Button>
      {open && (
        <CourierDialog
          open={open}
          onOpenChange={setOpen}
          initial={courierValues(shipping)}
          previousExpected={shipping.expectedDelivery}
          title="Edit courier details"
          description="The customer sees the updated details on their order page."
          saveLabel="Save details"
          pending={pending}
          onSave={save}
        />
      )}
    </>
  )
}

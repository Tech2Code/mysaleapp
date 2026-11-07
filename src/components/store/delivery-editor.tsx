"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, LockIcon, PencilIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, TextAreaField, TextField } from "@/components/form"
import { splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
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
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"

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
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    values: {
      name: delivery.name,
      phone: delivery.phone,
      address: delivery.address,
      ...splitCityState(delivery.city),
      pincode: delivery.pincode,
      note: delivery.note ?? "",
    },
  })
  const { errors } = form.formState
  const area = usePincodeLookup({
    pincode: useWatch({ control: form.control, name: "pincode" }) ?? "",
    getCity: () => form.getValues("city"),
    setCity: (city) => form.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => form.getValues("state"),
    setState: (state) => form.setValue("state", state as IndianState, { shouldValidate: true, shouldDirty: true }),
  })

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
      later(() => toast.success("Delivery details updated"))
      setOpen(false)
      if (onChanged) onChanged(res.data.phoneLast4)
      else router.refresh()
    })
  })

  return (
    <section data-ui="store/DeliveryEditor" aria-labelledby="delivery-title" className="rounded-3xl border bg-card p-5 text-sm sm:p-6">
      <div data-ui="store/DeliveryEditor/div-flex" className="mb-2 flex items-center justify-between gap-3">
        <h3 data-ui="store/DeliveryEditor/h3-delivery-address" id="delivery-title" className="font-sans text-lg font-semibold">
          Delivery address
        </h3>
        {editable && (
          <Button data-ui="store/DeliveryEditor/Button-edit" variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <PencilIcon /> Edit
          </Button>
        )}
      </div>

      <p data-ui="store/DeliveryEditor/p" className="font-medium">
        {delivery.name} · {delivery.phone}
      </p>
      <p data-ui="store/DeliveryEditor/p-2" className="text-muted-foreground">
        {delivery.address}, {delivery.city} - {delivery.pincode}
      </p>
      {delivery.note && <p data-ui="store/DeliveryEditor/p-3" className="mt-2 text-muted-foreground">Note: {delivery.note}</p>}

      <p data-ui="store/DeliveryEditor/p-flex" className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
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
          <DialogContent data-ui="store/DeliveryEditor/DialogContent" className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
            <form data-ui="store/DeliveryEditor/form" onSubmit={onSubmit} noValidate className="space-y-1">
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
              <div data-ui="store/DeliveryEditor/div-grid" className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                <TextField
                  label="Pincode" kind="pincode"
                  inputMode="numeric"
                  maxLength={6}
                  hint={area.hint}
                  error={errors.pincode?.message}
                  {...form.register("pincode")}
                />
                <TextField label="City" kind="city" error={errors.city?.message} {...form.register("city")} />
                <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName="sm:col-span-2" />
              </div>
              <TextAreaField label="Note (optional)" maxLength={LIMITS.note.max} rows={2} error={errors.note?.message} {...form.register("note")} />
              {serverError && (
                <p data-ui="store/DeliveryEditor/p-4" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                  {serverError}
                </p>
              )}
              <DialogFooter>
                <Button data-ui="store/DeliveryEditor/Button-cancel" type="button" variant="outline" size="lg" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button data-ui="store/DeliveryEditor/Button-save-changes" type="submit" size="lg" disabled={pending}>
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

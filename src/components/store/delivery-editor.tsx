"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, Loader2Icon, LockIcon, PencilIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, TextAreaField, TextField } from "@/components/form"
import { joinCityState, splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateOrderDelivery } from "@/features/orders/actions"
import { checkoutSchema, type CheckoutInput } from "@/features/orders/schema"
import type { DeliveryDetails, OrderStatus } from "@/features/orders/types"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./order-status.module.css"

function deliveryStatusFootnote(editable: boolean, status?: OrderStatus): { text: string; locked: boolean } | null {
  if (editable || status === "pending") {
    return { text: "You can change these details until your order is confirmed.", locked: false }
  }
  switch (status) {
    case "cancelled":
      return null
    case "delivered":
      return { text: "This order was delivered to this address.", locked: false }
    case "shipped":
      return { text: "Your order is on its way to this address, so delivery details can no longer be changed.", locked: true }
    case "packed":
      return { text: "Your order is packed for dispatch, so the address is locked. Message us on WhatsApp urgently if something is wrong.", locked: true }
    case "confirmed":
    default:
      return { text: "Your order is confirmed, so the address is locked. Message us on WhatsApp if something is wrong.", locked: true }
  }
}

/**
 * Delivery address of an order. While the order is still pending (not confirmed)
 * the customer can edit it here; afterwards it is locked.
 */
export function DeliveryEditor({
  orderCode,
  delivery,
  editable,
  status,
  phoneLast4,
  onChanged,
}: {
  orderCode: string
  delivery: DeliveryDetails
  editable: boolean
  status?: OrderStatus
  /** Needed for guests (from the track page). Signed-in owners don't need it. */
  phoneLast4?: string
  /** Called after saving, with the (possibly new) last 4 digits of the phone. Defaults to refreshing the page. */
  onChanged?: (newPhoneLast4: string) => void | Promise<unknown>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const initialSplit = splitCityState(delivery.city)
  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    values: {
      name: delivery.name,
      phone: delivery.phone,
      address: delivery.address,
      ...initialSplit,
      pincode: delivery.pincode,
      note: delivery.note ?? "",
    },
  })
  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      const split = splitCityState(delivery.city)
      area.prime(delivery.pincode, split.city, split.state)
      form.reset({
        name: delivery.name,
        phone: delivery.phone,
        address: delivery.address,
        ...split,
        pincode: delivery.pincode,
        note: delivery.note ?? "",
      })
    }
  }
  const { errors } = form.formState
  const [nameVal, phoneVal, addressVal, cityVal, stateVal, pincodeVal, noteVal] = useWatch({
    control: form.control,
    name: ["name", "phone", "address", "city", "state", "pincode", "note"],
  })

  const normalizedPhone = normalizeIndianPhone(phoneVal ?? "") ?? (phoneVal ?? "").trim()
  const initialPhone = normalizeIndianPhone(delivery.phone) ?? delivery.phone.trim()
  const hasChanges =
    (nameVal ?? "").trim() !== delivery.name.trim() ||
    normalizedPhone !== initialPhone ||
    (addressVal ?? "").trim() !== delivery.address.trim() ||
    joinCityState((cityVal ?? "").trim(), stateVal ?? initialSplit.state) !== delivery.city.trim() ||
    (pincodeVal ?? "").trim() !== delivery.pincode.trim() ||
    (noteVal ?? "").trim() !== (delivery.note ?? "").trim()

  const area = usePincodeLookup({
    pincode: pincodeVal ?? "",
    getCity: () => form.getValues("city"),
    setCity: (city) => form.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => form.getValues("state"),
    setState: (state) => form.setValue("state", state as IndianState, { shouldValidate: true, shouldDirty: true }),
  })

  const onSubmit = form.handleSubmit((values) => {
    if (!hasChanges) return
    if (area.error) {
      form.setError("pincode", { message: area.error })
      return
    }
    startTransition(async () => {
      const res = await updateOrderDelivery({
        code: orderCode,
        phoneLast4,
        phone: delivery.phone,
        customer: values,
      })
      if (!res.ok) {
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof CheckoutInput, { message: messages[0] })
        }
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        toast.success("Delivery details updated")
      })
      if (onChanged) await onChanged(res.data.phoneLast4)
      else router.refresh()
    })
  })

  const footnote = deliveryStatusFootnote(editable, status)

  return (
    <section aria-labelledby="delivery-title" className={styles.deliverySectionCard}>
      <div className={styles.deliveryTopRow}>
        <h3 id="delivery-title" className={styles.deliveryHeading}>
          Delivery address
        </h3>
        {editable && (
          <Button variant="outline" size="sm" className={styles.editBtn} onClick={() => setOpen(true)}>
            <PencilIcon /> Edit
          </Button>
        )}
      </div>

      <p className={styles.recipientLine}>
        {delivery.name} · +91 {delivery.phone}
      </p>
      <p className={styles.addressLine}>
        {delivery.address}, {delivery.city} - {delivery.pincode}
      </p>
      {delivery.note && <p className={styles.noteLine}>Note: {delivery.note}</p>}

      {footnote && (
        <p className={styles.footnoteRow}>
          {footnote.locked && <LockIcon className={styles.lockSvg} />}
          <span>{footnote.text}</span>
        </p>
      )}

      {editable && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent mobileFullScreen className={styles.deliveryDialogMax}>
            <form onSubmit={onSubmit} noValidate className={styles.deliveryEditForm}>
              <DialogHeader>
                <DialogTitle>Edit delivery details</DialogTitle>
                <DialogDescription>Order {orderCode}. You can change this until we confirm the order.</DialogDescription>
              </DialogHeader>
              <DialogBody>
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
                <div className={styles.deliveryCityGrid}>
                  <TextField
                    label="Pincode" kind="pincode"
                    inputMode="numeric"
                    maxLength={6}
                    hint={area.hint}
                    error={errors.pincode?.message || area.error}
                    {...form.register("pincode")}
                  />
                  <TextField label="City / District" kind="city" error={errors.city?.message} {...form.register("city")} />
                  <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName={styles.stateSpanFull} />
                </div>
                <TextAreaField label="Note (optional)" maxLength={LIMITS.note.max} rows={2} error={errors.note?.message} {...form.register("note")} />
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.dialogPillBtn}>
                  <XIcon className={styles.btnIcon} /> Cancel
                </Button>
                <Button type="submit" size="lg" disabled={pending || !hasChanges} className={styles.dialogPillBtn}>
                  {pending ? <Loader2Icon className={styles.spinIcon} /> : <CheckIcon className={styles.btnIcon} />} Save changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

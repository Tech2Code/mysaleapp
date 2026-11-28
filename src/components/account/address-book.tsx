"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, HomeIcon, Loader2Icon, MapPinIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { joinCityState, NO_STATE, splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { deleteAddress, saveAddress, setDefaultAddress } from "@/features/addresses/actions"
import { addressSchema, type AddressInput, type AddressValues } from "@/features/addresses/schema"
import { ADDRESS_LABELS, MAX_ADDRESSES, type Address } from "@/features/addresses/types"
import { normalizeIndianPhone } from "@/lib/format"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./account.module.css"

const labelOptions = ADDRESS_LABELS.map((l) => ({ value: l, label: l }))

function AddressDialog({
  address,
  isFirst,
  open,
  onOpenChange,
  defaults,
}: {
  address: Address | null
  isFirst: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults: { fullName: string; phone: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const initialSplit = address ? splitCityState(address.city) : { city: "", state: NO_STATE }
  const form = useForm<AddressInput, unknown, AddressValues>({
    resolver: zodResolver(addressSchema),
    // The dialog is remounted (see `key` in AddressBook) on every open, so these defaults are always fresh.
    // (`values` did not reset when the same address was reopened, so a previous toggle leaked into the next open.)
    defaultValues: {
      label: address?.label ?? "Home",
      fullName: address?.fullName ?? defaults.fullName,
      phone: address?.phone ?? defaults.phone,
      address: address?.address ?? "",
      ...initialSplit,
      pincode: address?.pincode ?? "",
      isDefault: address?.isDefault ?? isFirst,
    },
  })
  const { errors } = form.formState
  const [labelVal, fullNameVal, phoneVal, addressVal, cityVal, stateVal, pincodeVal, isDefaultVal] = useWatch({
    control: form.control,
    name: ["label", "fullName", "phone", "address", "city", "state", "pincode", "isDefault"],
  })

  const hasChanges = !address
    ? true
    : labelVal !== address.label ||
      (fullNameVal ?? "").trim() !== address.fullName.trim() ||
      (normalizeIndianPhone(phoneVal ?? "") ?? (phoneVal ?? "").trim()) !== (normalizeIndianPhone(address.phone) ?? address.phone.trim()) ||
      (addressVal ?? "").trim() !== address.address.trim() ||
      joinCityState((cityVal ?? "").trim(), (stateVal as IndianState) ?? initialSplit.state) !== address.city.trim() ||
      (pincodeVal ?? "").trim() !== address.pincode.trim() ||
      Boolean(isDefaultVal) !== Boolean(address.isDefault)

  const area = usePincodeLookup({
    pincode: pincodeVal ?? "",
    getCity: () => form.getValues("city"),
    setCity: (city) => form.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => form.getValues("state") as string,
    setState: (state) => form.setValue("state", state as IndianState, { shouldValidate: true, shouldDirty: true }),
  })

  const onSubmit = form.handleSubmit((values) => {
    if (address && !hasChanges) return
    if (area.error) {
      form.setError("pincode", { message: area.error })
      return
    }
    startTransition(async () => {
      const res = await saveAddress(address?.id ?? null, values)
      if (!res.ok) {
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof AddressInput, { message: messages[0] })
        }
        toast.error(res.error)
        return
      }
      later(() => {
        const split = splitCityState(values.city + ", " + values.state)
        area.prime(values.pincode, split.city || values.city, values.state)
        onOpenChange(false)
        toast.success(address ? "Address updated" : "Address added")
      })
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent mobileFullScreen className={styles.dialogModalLg}>
        <form onSubmit={onSubmit} noValidate className={styles.dialogFormFlex}>
          <DialogHeader>
            <DialogTitle>{address ? "Edit address" : "Add a new address"}</DialogTitle>
            <DialogDescription>Saved addresses can be picked in one tap at checkout.</DialogDescription>
          </DialogHeader>

          <DialogBody className={styles.dialogBodyStack}>
            <div className={styles.twoColFieldsGrid}>
              <FormSelectField control={form.control} name="label" label="Save as" options={labelOptions} />
              <TextField label="Full name" kind="personName" autoComplete="name" error={errors.fullName?.message} {...form.register("fullName")} />
            </div>
            <TextField
              label="Mobile number" kind="phone"
              type="tel"
              inputMode="tel"
              leading="+91"
              autoComplete="tel"
              error={errors.phone?.message}
              {...form.register("phone")}
            />
            <TextAreaField
              label="Full address" maxLength={LIMITS.address.max}
              rows={3}
              placeholder="House no., street, landmark"
              error={errors.address?.message}
              {...form.register("address")}
            />
            <div className={styles.twoColFieldsGrid}>
              <TextField
                label="Pincode" kind="pincode"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                hint={area.hint}
                error={errors.pincode?.message || area.error}
                {...form.register("pincode")}
              />
              <TextField label="City / District" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
              <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName={styles.spanTwoCols} />
            </div>
            <Controller
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <SwitchField
                  label="Make this my default address"
                  description="Used automatically at checkout"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => onOpenChange(false)} className={styles.pillBtnGap}>
              <XIcon className={styles.icon16} /> Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending || (Boolean(address) && !hasChanges)} className={styles.pillBtnGap}>
              {pending ? <Loader2Icon className={styles.spinSvg} /> : <CheckIcon className={styles.icon16} />} Save address
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The customer's saved addresses: add, edit, delete and choose a default. */
export function AddressBook({
  addresses,
  defaults,
}: {
  addresses: Address[]
  /** Pre-fills name and phone when adding a new address. */
  defaults: { fullName: string; phone: string }
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<Address | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const [deleting, setDeleting] = useState<Address | null>(null)
  const [pending, startTransition] = useTransition()
  const later = useToastAfter(pending)
  useBlockWhile(pending)

  const openNew = () => {
    setEditing(null)
    setOpenCount((n) => n + 1)
    setDialogOpen(true)
  }

  const makeDefault = (a: Address) =>
    startTransition(async () => {
      const res = await setDefaultAddress(a.id)
      if (res.ok) {
        later(() => toast.success(`“${a.label}” is now your default address`))
        router.refresh()
      } else toast.error(res.error)
    })

  const confirmDelete = () => {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteAddress(deleting.id)
      if (res.ok) {
        later(() => {
          setDeleting(null)
          toast.success("Address deleted")
        })
        router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <section aria-labelledby="addresses-title" className={styles.addressBookSection}>
      <div className={styles.addressHeaderRow}>
        <div>
          <h2 id="addresses-title" className={styles.ordersHeading}>
            Saved addresses
          </h2>
          <p className={styles.placedSubtext}>
            {addresses.length} of {MAX_ADDRESSES} saved. Pick one at checkout in a single tap.
          </p>
        </div>
        <Button onClick={openNew} disabled={addresses.length >= MAX_ADDRESSES} className={styles.addAddrPillBtn}>
          <PlusIcon /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className={styles.emptyAddrBox}>
          <MapPinIcon className={styles.pinIcon36} />
          <p className={styles.emptyAddrTitle}>No saved addresses yet</p>
          <p className={styles.emptyAddrSub}>Add your home or office address to check out faster next time.</p>
          <Button onClick={openNew} className={styles.addAddrPillBtn}>
            <PlusIcon /> Add your first address
          </Button>
        </div>
      ) : (
        <ul className={styles.addressesGrid}>
          {addresses.map((a) => (
            <li key={a.id} className={styles.addressCardItem}>
              <div className={styles.addrBadgesRow}>
                <span className={styles.labelBadgePill}>
                  <HomeIcon className={styles.icon14} aria-hidden /> {a.label}
                </span>
                {a.isDefault && (
                  <span className={styles.defaultStarPill}>
                    <StarIcon className={styles.starFill14} aria-hidden /> Default
                  </span>
                )}
              </div>
              <p className={styles.addrFullName}>{a.fullName}</p>
              <p className={styles.addrPhone}>+91 {a.phone}</p>
              <p className={styles.addrStreet}>
                {a.address}, {a.city} - {a.pincode}
              </p>
              <div className={styles.addrCardActions}>
                <Button
                  variant="outline"
                  size="sm"
                  className={styles.addAddrPillBtn}
                  onClick={() => {
                    setEditing(a)
                    setOpenCount((n) => n + 1)
                    setDialogOpen(true)
                  }}
                >
                  <PencilIcon /> Edit
                </Button>
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" className={styles.addAddrPillBtn} disabled={pending} onClick={() => makeDefault(a)}>
                    <StarIcon /> Set as default
                  </Button>
                )}
                <Button
                  variant="destructiveOutline"
                  size="sm"
                  onClick={() => setDeleting(a)}
                  aria-label={`Delete ${a.label} address`}
                  className={styles.deleteAddrBtn}
                >
                  <Trash2Icon aria-hidden="true" /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddressDialog
        key={`${editing?.id ?? "new"}-${openCount}`}
        address={editing}
        isFirst={addresses.length === 0}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaults={defaults}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !pending && setDeleting(null)}
        destructive
        title="Delete this address?"
        description={deleting ? `${deleting.label}: ${deleting.address}, ${deleting.city}. Orders you already placed are not affected.` : undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        pending={pending}
        onConfirm={confirmDelete}
      />
    </section>
  )
}

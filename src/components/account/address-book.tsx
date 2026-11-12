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
  const [serverError, setServerError] = useState<string | null>(null)

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
    setServerError(null)
    startTransition(async () => {
      const res = await saveAddress(address?.id ?? null, values)
      if (!res.ok) {
        setServerError(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          if (messages?.[0] && field in values) form.setError(field as keyof AddressInput, { message: messages[0] })
        }
        return
      }
      later(() => {
        onOpenChange(false)
        toast.success(address ? "Address updated" : "Address added")
      })
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent data-ui="account/AddressDialog/DialogContent" className="sm:max-w-lg">
        <form data-ui="account/AddressDialog/form-flex" onSubmit={onSubmit} noValidate className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{address ? "Edit address" : "Add a new address"}</DialogTitle>
            <DialogDescription>Saved addresses can be picked in one tap at checkout.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-2">
            <div data-ui="account/AddressDialog/div-grid" className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
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
            <div data-ui="account/AddressDialog/div-grid-2" className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <TextField
                label="Pincode" kind="pincode"
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                hint={area.hint}
                error={errors.pincode?.message || area.error}
                {...form.register("pincode")}
              />
              <TextField label="City" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
              <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName="sm:col-span-2" />
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

            {serverError && (
              <p data-ui="account/AddressDialog/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {serverError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button data-ui="account/AddressDialog/Button-cancel" type="button" variant="outline" size="lg" disabled={pending} onClick={() => onOpenChange(false)} className="gap-1.5 rounded-full">
              <XIcon className="size-4" /> Cancel
            </Button>
            <Button data-ui="account/AddressDialog/Button-save-address" type="submit" size="lg" disabled={pending || (Boolean(address) && !hasChanges)} className="gap-1.5 rounded-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckIcon className="size-4" />} Save address
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
    <section data-ui="account/AddressBook" aria-labelledby="addresses-title" className="space-y-4">
      <div data-ui="account/AddressBook/div-flex" className="flex flex-wrap items-end justify-between gap-3">
        <div data-ui="account/AddressBook/div">
          <h2 data-ui="account/AddressBook/h2-saved-addresses" id="addresses-title" className="text-2xl font-semibold">
            Saved addresses
          </h2>
          <p data-ui="account/AddressBook/p" className="text-sm text-muted-foreground">
            {addresses.length} of {MAX_ADDRESSES} saved. Pick one at checkout in a single tap.
          </p>
        </div>
        <Button data-ui="account/AddressBook/Button-add-address" onClick={openNew} disabled={addresses.length >= MAX_ADDRESSES} className="rounded-full">
          <PlusIcon /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div data-ui="account/AddressBook/div-flex-2" className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-14 text-center">
          <MapPinIcon className="size-9 text-muted-foreground" />
          <p data-ui="account/AddressBook/p-2" className="font-heading text-xl">No saved addresses yet</p>
          <p data-ui="account/AddressBook/p-3" className="max-w-sm text-sm text-muted-foreground">Add your home or office address to check out faster next time.</p>
          <Button data-ui="account/AddressBook/Button-add-your-first-address" onClick={openNew} className="rounded-full">
            <PlusIcon /> Add your first address
          </Button>
        </div>
      ) : (
        <ul data-ui="account/AddressBook/ul-grid" className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li data-ui="account/AddressBook/li-flex" key={a.id} className="flex flex-col rounded-3xl border bg-card p-5">
              <div data-ui="account/AddressBook/div-flex-3" className="flex items-center gap-2">
                <span data-ui="account/AddressBook/span-inline-flex" className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                  <HomeIcon className="size-3.5" aria-hidden /> {a.label}
                </span>
                {a.isDefault && (
                  <span data-ui="account/AddressBook/span-inline-flex-2" className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <StarIcon className="size-3.5 fill-current" aria-hidden /> Default
                  </span>
                )}
              </div>
              <p data-ui="account/AddressBook/p-4" className="mt-3 font-medium">{a.fullName}</p>
              <p data-ui="account/AddressBook/p-5" className="text-sm text-muted-foreground">+91 {a.phone}</p>
              <p data-ui="account/AddressBook/p-6" className="mt-1 text-sm">
                {a.address}, {a.city} - {a.pincode}
              </p>
              <div data-ui="account/AddressBook/div-flex-4" className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <Button data-ui="account/AddressBook/Button-edit"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setEditing(a)
                    setOpenCount((n) => n + 1)
                    setDialogOpen(true)
                  }}
                >
                  <PencilIcon /> Edit
                </Button>
                {!a.isDefault && (
                  <Button data-ui="account/AddressBook/Button-set-as-default" variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={() => makeDefault(a)}>
                    <StarIcon /> Set as default
                  </Button>
                )}
                <Button data-ui="account/AddressBook/Button-delete"
                  variant="ghost"
                  size="sm"
                  className="ml-auto rounded-full text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleting(a)}
                  aria-label={`Delete ${a.label} address`}
                >
                  <Trash2Icon /> Delete
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

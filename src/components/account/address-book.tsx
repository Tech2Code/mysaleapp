"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { HomeIcon, Loader2Icon, MapPinIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { deleteAddress, saveAddress, setDefaultAddress } from "@/features/addresses/actions"
import { addressSchema, type AddressInput, type AddressValues } from "@/features/addresses/schema"
import { ADDRESS_LABELS, MAX_ADDRESSES, type Address } from "@/features/addresses/types"
import { LIMITS } from "@/lib/validation"

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
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<AddressInput, unknown, AddressValues>({
    resolver: zodResolver(addressSchema),
    // `values` re-syncs the form each time a different address is opened
    values: {
      label: address?.label ?? "Home",
      fullName: address?.fullName ?? defaults.fullName,
      phone: address?.phone ?? defaults.phone,
      address: address?.address ?? "",
      city: address?.city ?? "",
      pincode: address?.pincode ?? "",
      isDefault: address?.isDefault ?? isFirst,
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
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
      toast.success(address ? "Address updated" : "Address added")
      onOpenChange(false)
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="space-y-1.5">
          <DialogHeader>
            <DialogTitle>{address ? "Edit address" : "Add a new address"}</DialogTitle>
            <DialogDescription>Saved addresses can be picked in one tap at checkout.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
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
          <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            <TextField label="City" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
            <TextField
              label="Pincode" kind="pincode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              error={errors.pincode?.message}
              {...form.register("pincode")}
            />
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
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {serverError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Save address
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
  const [deleting, setDeleting] = useState<Address | null>(null)
  const [pending, startTransition] = useTransition()

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const makeDefault = (a: Address) =>
    startTransition(async () => {
      const res = await setDefaultAddress(a.id)
      if (res.ok) {
        toast.success(`“${a.label}” is now your default address`)
        router.refresh()
      } else toast.error(res.error)
    })

  const confirmDelete = () => {
    if (!deleting) return
    startTransition(async () => {
      const res = await deleteAddress(deleting.id)
      if (res.ok) {
        toast.success("Address deleted")
        setDeleting(null)
        router.refresh()
      } else toast.error(res.error)
    })
  }

  return (
    <section data-ui="account/AddressBook" aria-labelledby="addresses-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="addresses-title" className="text-2xl font-semibold">
            Saved addresses
          </h2>
          <p className="text-sm text-muted-foreground">
            {addresses.length} of {MAX_ADDRESSES} saved. Pick one at checkout in a single tap.
          </p>
        </div>
        <Button onClick={openNew} disabled={addresses.length >= MAX_ADDRESSES} className="rounded-full">
          <PlusIcon /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-14 text-center">
          <MapPinIcon className="size-9 text-muted-foreground" />
          <p className="font-heading text-xl">No saved addresses yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Add your home or office address to check out faster next time.</p>
          <Button onClick={openNew} className="rounded-full">
            <PlusIcon /> Add your first address
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                  <HomeIcon className="size-3.5" aria-hidden /> {a.label}
                </span>
                {a.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <StarIcon className="size-3.5 fill-current" aria-hidden /> Default
                  </span>
                )}
              </div>
              <p className="mt-3 font-medium">{a.fullName}</p>
              <p className="text-sm text-muted-foreground">+91 {a.phone}</p>
              <p className="mt-1 text-sm">
                {a.address}, {a.city} - {a.pincode}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setEditing(a)
                    setDialogOpen(true)
                  }}
                >
                  <PencilIcon /> Edit
                </Button>
                {!a.isDefault && (
                  <Button variant="ghost" size="sm" className="rounded-full" disabled={pending} onClick={() => makeDefault(a)}>
                    <StarIcon /> Set as default
                  </Button>
                )}
                <Button
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
        address={editing}
        isFirst={addresses.length === 0}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaults={defaults}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this address?</DialogTitle>
            <DialogDescription>
              {deleting && `${deleting.label}: ${deleting.address}, ${deleting.city}.`} Orders you already placed are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={pending} onClick={confirmDelete}>
              {pending && <Loader2Icon className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

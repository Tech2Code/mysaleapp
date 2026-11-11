"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, Loader2Icon, MapPinIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { NO_STATE, splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { PriceBreakdown } from "@/components/shared/price-breakdown"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { getMyProfile } from "@/features/account/actions"
import type { Profile } from "@/features/account/schema"
import { listMyAddresses } from "@/features/addresses/actions"
import type { Address } from "@/features/addresses/types"
import { placeOrder } from "@/features/orders/actions"
import { calculateCharges, formatWeightGrams } from "@/features/orders/pricing"
import { placeholderCartLines } from "@/features/products/placeholders"
import { checkoutSchema, type CheckoutInput } from "@/features/orders/schema"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useCart } from "@/store/cart"
import { useStoreSettings } from "./store-settings-provider"
import { FreeShippingBar } from "./cart-drawer"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile } from "@/components/shared/busy-overlay"

export const LAST_ORDER_KEY = "kk-last-order"

/** `preview`: render the placeholder form as-is; loading.tsx wraps it in <Skeletonize>. Before hydration it wraps itself. */
export function CheckoutForm({
  products,
  initialAddresses = [],
  initialProfile = null,
  preview = false,
}: {
  products: LiveProduct[]
  initialAddresses?: Address[]
  initialProfile?: Profile | null
  preview?: boolean
}) {
  const router = useRouter()
  const { ready, available, hasUnavailable, charges } = useLiveCart(products)
  const clearCart = useCart((s) => s.clear)
  const shop = useStoreSettings()
  const { user, ready: authReady } = useAuth()
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [serverError, setServerError] = useState<string | null>(null)
  const initialDefault = initialAddresses[0]
  const [clientAddresses, setClientAddresses] = useState<Address[] | null>(null)
  const addresses = initialAddresses.length > 0 || clientAddresses === null ? initialAddresses : clientAddresses
  /** id of the saved address in use, or "new" when typing a different one */
  const [selectedId, setSelected] = useState<string>(initialDefault ? initialDefault.id : "new")
  const selected = selectedId === "new" || addresses.some((a) => a.id === selectedId) ? selectedId : (addresses[0]?.id ?? "new")
  const [saveAddress, setSaveAddress] = useState(true)
  const fetchedForUser = useRef<string | null>(null)

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: initialDefault
      ? {
          name: initialDefault.fullName,
          phone: initialDefault.phone,
          address: initialDefault.address,
          ...splitCityState(initialDefault.city),
          pincode: initialDefault.pincode,
          note: "",
        }
      : {
          name: initialProfile?.fullName ?? "",
          phone: initialProfile?.phone ?? "",
          address: "",
          city: "",
          state: NO_STATE,
          pincode: "",
          note: "",
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

  const fillFrom = (a: Address) => {
    setSelected(a.id)
    form.reset({
      name: a.fullName,
      phone: a.phone,
      address: a.address,
      ...splitCityState(a.city),
      pincode: a.pincode,
      note: form.getValues("note"),
    })
  }

  const useNewAddress = () => {
    setSelected("new")
    const current = form.getValues()
    form.reset({ name: current.name, phone: current.phone, address: "", city: "", state: NO_STATE, pincode: "", note: current.note })
  }

  // Pre-fill form if initialAddresses arrives from server revalidation while form is still blank
  useEffect(() => {
    const first = initialAddresses[0]
    if (first && !form.formState.isDirty && !form.getValues("address")) {
      form.reset({
        name: first.fullName,
        phone: first.phone,
        address: first.address,
        ...splitCityState(first.city),
        pincode: first.pincode,
        note: form.getValues("note"),
      })
    }
  }, [initialAddresses, form])

  // Signed-in customers: fallback if server did not preload addresses (e.g. client-only session)
  useEffect(() => {
    if (!authReady || !user) return
    if (initialAddresses.length > 0 || fetchedForUser.current === user.id) return
    fetchedForUser.current = user.id
    let cancelled = false
    Promise.all([listMyAddresses(), getMyProfile()])
      .then(([list, profile]) => {
        if (cancelled) return
        setClientAddresses(list)
        if (form.formState.isDirty) return
        const first = list[0]
        if (first) {
          setSelected(first.id)
          form.reset({
            name: first.fullName,
            phone: first.phone,
            address: first.address,
            ...splitCityState(first.city),
            pincode: first.pincode,
            note: form.getValues("note"),
          })
        } else if (profile) {
          const current = form.getValues()
          form.reset({ ...current, name: current.name || profile.fullName, phone: current.phone || profile.phone })
        }
      })
      .catch(() => {
        fetchedForUser.current = null
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, form, initialAddresses.length])

  const onSubmit = form.handleSubmit((values) => {
    if (area.error) {
      form.setError("pincode", { message: area.error })
      return
    }
    setServerError(null)
    startTransition(async () => {
      const res = await placeOrder({
        customer: values,
        items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        // only offer to save when the customer typed a new address
        saveAddress: Boolean(user) && selected === "new" && saveAddress,
      })
      if (!res.ok) {
        setServerError(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          const msg = messages?.[0]
          if (msg && field in values) form.setError(field as keyof CheckoutInput, { message: msg })
        }
        toast.error(res.error)
        return
      }
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(res.data))
      } catch {
        // private mode: the success page falls back to the code in the URL
      }
      clearCart()
      router.push(`/order-placed?code=${encodeURIComponent(res.data.orderCode)}`)
    })
  })

  // The real cart is in localStorage (unknown until hydration): show a placeholder order in the real layout meanwhile.
  const placeholder = !ready || preview
  const shown = placeholder ? placeholderCartLines() : available
  const shownCharges = placeholder ? calculateCharges(shown, shop) : charges
  const shownCount = shown.reduce((n, l) => n + l.quantity, 0)

  if (!placeholder && available.length === 0) {
    return (
      <div data-ui="store/CheckoutForm" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
        <p data-ui="store/CheckoutForm/p" className="font-heading text-2xl">Your cart is empty</p>
        <Link data-ui="store/CheckoutForm/Link-browse-products" href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Browse products
        </Link>
      </div>
    )
  }

  const view = (
    <form data-ui="store/CheckoutForm/form-grid" onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div data-ui="store/CheckoutForm/div" className="space-y-1 rounded-3xl border bg-card p-5 sm:p-8">
        <div data-ui="store/CheckoutForm/div-2">
          <h2 data-ui="store/CheckoutForm/h2-delivery-details" className="text-2xl font-semibold">Delivery details</h2>
          <p data-ui="store/CheckoutForm/p-2" className="mt-1 text-sm text-muted-foreground">
            {user ? (
              addresses.length > 0 ? "Choose a saved address or add a new one." : "Enter where we should deliver."
            ) : (
              <>
                Checking out as a guest.{" "}
                <Link data-ui="store/CheckoutForm/Link-sign-in" href="/login?next=/checkout" className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                to save your address and track orders.
              </>
            )}
          </p>
        </div>

        {user && addresses.length > 0 && (
          <fieldset data-ui="store/CheckoutForm/fieldset" className="space-y-3">
            <legend data-ui="store/CheckoutForm/legend-saved-addresses" className="sr-only">Saved addresses</legend>
            <div data-ui="store/CheckoutForm/div-grid" className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => {
                const active = selected === a.id
                return (
                  <label data-ui="store/CheckoutForm/label"
                    key={a.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col rounded-2xl border p-4 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/40",
                      active ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <input data-ui="store/CheckoutForm/input-saved-address" type="radio" name="saved-address" className="sr-only" checked={active} onChange={() => fillFrom(a)} />
                    <span data-ui="store/CheckoutForm/span-flex" className="flex items-center gap-2 font-semibold">
                      <MapPinIcon className="size-4 text-primary" aria-hidden /> {a.label}
                      {a.isDefault && <span data-ui="store/CheckoutForm/span" className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem]">Default</span>}
                      {active && <CheckCircle2Icon className="ml-auto size-4 text-primary" aria-hidden />}
                    </span>
                    <span data-ui="store/CheckoutForm/span-2" className="mt-1 font-medium">{a.fullName}</span>
                    <span data-ui="store/CheckoutForm/span-3" className="line-clamp-2 text-muted-foreground">
                      {a.address}, {a.city} - {a.pincode}
                    </span>
                  </label>
                )
              })}
              <button data-ui="store/CheckoutForm/button-use-a-different-addres"
                type="button"
                onClick={useNewAddress}
                aria-pressed={selected === "new"}
                className={cn(
                  "flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-sm font-semibold transition-colors",
                  selected === "new" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <PlusIcon className="size-4" /> Use a different address
              </button>
            </div>
            <p data-ui="store/CheckoutForm/p-3" className="text-xs text-muted-foreground">
              Need to change a saved address?{" "}
              <Link data-ui="store/CheckoutForm/Link-manage-addresses" href="/account/profile" className="font-medium text-primary underline-offset-4 hover:underline">
                Manage addresses
              </Link>
            </p>
          </fieldset>
        )}

        <div data-ui="store/CheckoutForm/div-grid-2" className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
          <TextField label="Full name" kind="personName" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
          <TextField
            label="WhatsApp / mobile number" kind="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            leading="+91"
            hint="We'll confirm your order on this number"
            error={errors.phone?.message}
            {...form.register("phone")}
          />
          <TextAreaField
            label="Full address" maxLength={LIMITS.address.max}
            autoComplete="street-address"
            rows={3}
            placeholder="House no., street, landmark"
            containerClassName="sm:col-span-2"
            error={errors.address?.message}
            {...form.register("address")}
          />
          <TextField
            label="Pincode" kind="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            hint={area.hint}
            error={errors.pincode?.message || area.error}
            {...form.register("pincode")}
          />
          <TextField label="City" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
          <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName="sm:col-span-2" />
          <TextAreaField
            label="Note (optional)" maxLength={LIMITS.note.max}
            rows={2}
            hint="Gift message, custom name, preferred colour…"
            containerClassName="sm:col-span-2"
            error={errors.note?.message}
            {...form.register("note")}
          />
        </div>

        {user && selected === "new" && (
          <SwitchField
            label="Save this address to my account"
            description="Use it next time in one tap"
            checked={saveAddress}
            onCheckedChange={setSaveAddress}
          />
        )}
      </div>

      <aside data-ui="store/CheckoutForm/aside" className="h-fit space-y-5 rounded-3xl border bg-card p-6 lg:sticky-store">
        <h2 data-ui="store/CheckoutForm/h2-your-order" className="flex items-baseline justify-between gap-3 text-xl font-semibold">
          Your order
          <span data-ui="store/CheckoutForm/span-4" className="text-sm font-medium text-muted-foreground">
            {shownCount} item{shownCount === 1 ? "" : "s"}
          </span>
        </h2>
        <ul data-ui="store/CheckoutForm/ul" className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {shown.map((l) => (
            <li data-ui="store/CheckoutForm/li-flex" key={l.productId} className="flex items-center gap-3">
              <div data-ui="store/CheckoutForm/div-relative" className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                <ProductImage src={l.image} alt={l.name} sizes="56px" />
                <span data-ui="store/CheckoutForm/span-grid" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">
                  {l.quantity}
                </span>
              </div>
              <span data-ui="store/CheckoutForm/span-5" className="min-w-0 flex-1 text-sm font-medium">
                <span data-ui="store/CheckoutForm/span-6" className="line-clamp-2">{l.name}</span>
                <span data-ui="store/CheckoutForm/span-7" className="mt-0.5 block text-xs font-normal text-muted-foreground">
                  {formatPrice(l.price)} × {l.quantity}
                </span>
                {(l.shippingClass !== "standard" || l.weightGrams > 0) && (
                  <span data-ui="store/CheckoutForm/span-8" className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {[
                      l.shippingClass === "oversized" ? "Large / bulky" : l.shippingClass === "fragile" ? "Fragile" : null,
                      l.weightGrams > 0 ? formatWeightGrams(l.weightGrams * l.quantity) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
              <span data-ui="store/CheckoutForm/span-9" className="shrink-0 text-sm font-semibold">{formatPrice(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        {!placeholder && hasUnavailable && (
          <p data-ui="store/CheckoutForm/p-4" className="text-xs text-destructive">Unavailable items were left out of this order.</p>
        )}
        <FreeShippingBar subtotal={shownCharges.subtotal} />
        <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Total to pay" className="border-t pt-4" />
        {serverError && (
          <p data-ui="store/CheckoutForm/p-5" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {serverError}
          </p>
        )}
        <Button data-ui="store/CheckoutForm/Button"
          type="submit"
          size="lg"
          disabled={pending || placeholder}
          className="h-13 w-full rounded-full text-base shadow-lg shadow-primary/25"
        >
          {pending ? <Loader2Icon className="size-5 animate-spin" /> : null}
          {pending ? "Placing order…" : `Place order & pay · ${formatPrice(shownCharges.total)}`}
        </Button>
        <div data-ui="store/CheckoutForm/div-3" className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <p data-ui="store/CheckoutForm/p-flex" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-primary shrink-0" />
            <span data-ui="store/CheckoutForm/span-10">Instant UPI payment on next step</span>
          </p>
          <span className="text-[11px] font-medium text-foreground/80">100% Safe Checkout</span>
        </div>
      </aside>
    </form>
  )
  return preview || ready ? view : <Skeletonize>{view}</Skeletonize>
}

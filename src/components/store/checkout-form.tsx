"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, CopyIcon, Loader2Icon, MapPinIcon, PlusIcon, QrCodeIcon, SmartphoneIcon, TicketPercentIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { NO_STATE, splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { PriceBreakdown } from "@/components/shared/price-breakdown"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeletonize } from "@/components/shared/skeletonize"
import { getMyProfile } from "@/features/account/actions"
import type { Profile } from "@/features/account/schema"
import { listMyAddresses } from "@/features/addresses/actions"
import type { Address } from "@/features/addresses/types"
import { placeOrder, validatePromoCode } from "@/features/orders/actions"
import { applyPromoToCharges, calculateCharges, computePromoDiscount, formatWeightGrams, type ValidatedPromo } from "@/features/orders/pricing"
import { placeholderCartLines } from "@/features/products/placeholders"
import { checkoutSchema, paymentReferenceSchema, type CheckoutInput } from "@/features/orders/schema"
import { buildUpiUrl } from "@/features/orders/upi"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
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
  const signedIn = Boolean(user) || (!authReady && (initialProfile !== null || initialAddresses.length > 0))
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [serverError, setServerError] = useState<string | null>(null)
  const initialDefault = initialAddresses[0]
  const [clientAddresses, setClientAddresses] = useState<Address[] | null>(null)
  const [clearedOnSignOut, setClearedOnSignOut] = useState(false)
  const addresses = clearedOnSignOut ? (clientAddresses ?? []) : (clientAddresses ?? initialAddresses)
  /** id of the saved address in use, or "new" when typing a different one */
  const [selectedId, setSelected] = useState<string>(initialDefault ? initialDefault.id : "new")
  const selected = selectedId === "new" || addresses.some((a) => a.id === selectedId) ? selectedId : (addresses[0]?.id ?? "new")
  const [saveAddress, setSaveAddress] = useState(true)
  const [hasOrderNote, setHasOrderNote] = useState(false)
  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [showMobileQr, setShowMobileQr] = useState(false)
  const [validatedCustomer, setValidatedCustomer] = useState<CheckoutInput | null>(null)
  const [paymentRef, setPaymentRef] = useState("")
  const [paymentRefError, setPaymentRefError] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoPending, startPromoTransition] = useTransition()
  const fetchedForUser = useRef<string | null>(null)
  const wasSignedIn = useRef(signedIn)

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

  // Pre-fill form if initialAddresses or initialProfile arrives from server revalidation while form is still blank
  useEffect(() => {
    if (form.formState.isDirty) return
    const first = initialAddresses[0]
    if (first && !form.getValues("address")) {
      queueMicrotask(() => setSelected(first.id))
      form.reset({
        name: first.fullName,
        phone: first.phone,
        address: first.address,
        ...splitCityState(first.city),
        pincode: first.pincode,
        note: form.getValues("note"),
      })
    } else if (!first && initialProfile && (!form.getValues("name") || !form.getValues("phone"))) {
      const current = form.getValues()
      form.reset({
        ...current,
        name: current.name || initialProfile.fullName,
        phone: current.phone || initialProfile.phone,
      })
    }
  }, [initialAddresses, initialProfile, form])

  // Clear cached account addresses/autofill if the user signs out while CheckoutForm stays mounted
  useEffect(() => {
    if (signedIn) {
      wasSignedIn.current = true
      return
    }
    if (!authReady || !wasSignedIn.current) return
    wasSignedIn.current = false
    fetchedForUser.current = null
    form.reset({ name: "", phone: "", address: "", city: "", state: NO_STATE, pincode: "", note: "" })
    queueMicrotask(() => {
      setClearedOnSignOut(true)
      setClientAddresses(null)
      setSelected("new")
      setValidatedCustomer(null)
      setPayDialogOpen(false)
      setPaymentRef("")
      setPaymentRefError(null)
      setPromoInput("")
      setAppliedPromo(null)
      setPromoError(null)
      setServerError(null)
    })
  }, [authReady, signedIn, form])

  // Signed-in customers: fallback if server did not preload addresses (or after sign-out/account switch)
  useEffect(() => {
    if (!authReady || !user) return
    if ((!clearedOnSignOut && initialAddresses.length > 0) || fetchedForUser.current === user.id) return
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
  }, [authReady, user, form, initialAddresses.length, clearedOnSignOut])

  const onSubmit = form.handleSubmit((values) => {
    if (area.error) {
      form.setError("pincode", { message: area.error })
      return
    }
    setServerError(null)
    setPaymentRefError(null)
    setValidatedCustomer(values)
    setPayDialogOpen(true)
  })

  const parsedPaymentRef = paymentReferenceSchema.safeParse(paymentRef)
  const isPaymentRefValid = parsedPaymentRef.success

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Enter a promo code")
      return
    }
    setPromoError(null)
    startPromoTransition(async () => {
      const res = await validatePromoCode({ code, subtotal: charges.subtotal })
      if (!res.ok) {
        setPromoError(res.error)
        toast.error(res.error)
        return
      }
      setAppliedPromo(res.data)
      setPromoInput("")
      toast.success(`Promo code ${res.data.code} applied! You saved ${formatPrice(res.data.discountAmount)}.`)
    })
  }

  const handleRemovePromo = () => {
    const prev = appliedPromo
    setAppliedPromo(null)
    setPromoError(null)
    if (prev) toast.success(`Removed promo code ${prev.code}.`)
  }

  const confirmPaymentAndPlaceOrder = () => {
    if (!validatedCustomer) return
    const parsedRef = paymentReferenceSchema.safeParse(paymentRef)
    if (!parsedRef.success) {
      setPaymentRefError(parsedRef.error.issues[0]?.message ?? "Please enter your 12-digit UTR / UPI reference number.")
      return
    }
    setPaymentRefError(null)
    setServerError(null)
    startTransition(async () => {
      const activeDiscount = computePromoDiscount(appliedPromo, charges.subtotal)
      const res = await placeOrder({
        customer: validatedCustomer,
        items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentReference: parsedRef.data,
        promoCode: appliedPromo && activeDiscount > 0 ? appliedPromo.code : undefined,
        // only offer to save when the customer typed a new address
        saveAddress: signedIn && selected === "new" && saveAddress,
      })
      if (!res.ok) {
        const refFieldMsg = res.fieldErrors?.paymentReference?.[0]
        if (refFieldMsg) {
          setPaymentRefError(refFieldMsg)
          toast.error(refFieldMsg)
          return
        }
        if (res.error.toLowerCase().includes("promo code")) {
          setAppliedPromo(null)
          setPromoError(res.error)
          setPayDialogOpen(false)
          toast.error(res.error)
          return
        }
        setServerError(res.error)
        for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
          const msg = messages?.[0]
          if (msg && field in validatedCustomer) {
            form.setError(field as keyof CheckoutInput, { message: msg })
            setPayDialogOpen(false)
          }
        }
        toast.error(res.error)
        return
      }
      setPayDialogOpen(false)
      setAppliedPromo(null)
      setPromoInput("")
      setPromoError(null)
      setPaymentRef("")
      try {
        sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(res.data))
      } catch {
        // private mode: the success page falls back to the code in the URL
      }
      clearCart()
      router.push(`/order-placed?code=${encodeURIComponent(res.data.orderCode)}`)
    })
  }

  // The real cart is in localStorage (unknown until hydration): show a placeholder order in the real layout meanwhile.
  const placeholder = !ready || preview
  const shown = placeholder ? placeholderCartLines() : available
  const baseCharges = placeholder ? calculateCharges(shown, shop) : charges
  const shownCharges = placeholder ? baseCharges : applyPromoToCharges(baseCharges, appliedPromo)
  const shownCount = shown.reduce((n, l) => n + l.quantity, 0)
  const promoBelowMin = Boolean(
    !placeholder && appliedPromo && baseCharges.subtotal < Math.max(appliedPromo.minOrderAmount, 2)
  )

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

  const hasAddressFieldError = Boolean(
    errors.name || errors.phone || errors.address || errors.pincode || errors.city || errors.state || area.error
  )
  const showAddressInputs = !signedIn || addresses.length === 0 || selected === "new" || hasAddressFieldError

  const view = (
    <form data-ui="store/CheckoutForm/form-grid" onSubmit={onSubmit} noValidate className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
      <div data-ui="store/CheckoutForm/div-flex" className="flex min-w-0 flex-col gap-6">
        {/* Step 1: Delivery details */}
        <div data-ui="store/CheckoutForm/div" className="space-y-4 rounded-3xl border bg-card p-5 sm:p-7">
          <div data-ui="store/CheckoutForm/div-flex-2" className="flex flex-wrap items-start justify-between gap-2">
            <div data-ui="store/CheckoutForm/div-2">
              <h2 data-ui="store/CheckoutForm/h2-delivery-details" className="flex items-center gap-2.5 text-xl sm:text-2xl font-semibold">
                <span data-ui="store/CheckoutForm/span-grid" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 font-sans text-xs font-bold text-primary">
                  1
                </span>
                Delivery details
              </h2>
              <p data-ui="store/CheckoutForm/p-2" className="mt-1 text-sm text-muted-foreground">
                {signedIn ? (
                  addresses.length > 0 ? "Select a delivery address or add a new one." : "Enter where we should deliver."
                ) : authReady ? (
                  <>
                    Checking out as a guest.{" "}
                    <Link data-ui="store/CheckoutForm/Link-sign-in" href="/login?next=/checkout" className="font-medium text-primary underline-offset-4 hover:underline">
                      Sign in
                    </Link>{" "}
                    to save your address and track orders.
                  </>
                ) : (
                  "Enter where we should deliver."
                )}
              </p>
            </div>
            {signedIn && addresses.length > 0 && (
              <Link
                data-ui="store/CheckoutForm/Link-manage-addresses"
                href="/account/profile?tab=addresses"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Manage addresses
              </Link>
            )}
          </div>

          {signedIn && addresses.length > 0 && (
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
                        active ? "border-primary bg-primary/5 shadow-xs" : "hover:bg-muted/50"
                      )}
                    >
                      <input data-ui="store/CheckoutForm/input-saved-address" type="radio" name="saved-address" className="sr-only" checked={active} onChange={() => fillFrom(a)} />
                      <span data-ui="store/CheckoutForm/span-flex" className="flex items-center gap-2 font-semibold">
                        <MapPinIcon className="size-4 text-primary" aria-hidden /> {a.label}
                        {a.isDefault && <span data-ui="store/CheckoutForm/span" className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem]">Default</span>}
                        {active && <CheckCircle2Icon className="ml-auto size-4 text-primary" aria-hidden />}
                      </span>
                      <span data-ui="store/CheckoutForm/span-2" className="mt-1.5 font-medium">
                        {a.fullName} <span data-ui="store/CheckoutForm/span-3" className="font-normal text-muted-foreground">· +91 {a.phone}</span>
                      </span>
                      <span data-ui="store/CheckoutForm/span-4" className="mt-0.5 line-clamp-2 text-muted-foreground">
                        {a.address}, {a.city} - {a.pincode}
                      </span>
                    </label>
                  )
                })}
                <button data-ui="store/CheckoutForm/button-add-new-address"
                  type="button"
                  onClick={useNewAddress}
                  aria-pressed={selected === "new"}
                  className={cn(
                    "flex min-h-14 items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-colors sm:min-h-24",
                    selected === "new"
                      ? "border-primary bg-primary/5 text-primary shadow-xs"
                      : "border-input bg-muted/25 text-foreground/80 hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <PlusIcon className="size-4 shrink-0 text-primary" /> Add new address
                </button>
              </div>
            </fieldset>
          )}

          {showAddressInputs && (
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
              <TextField label="City / District" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
              <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName="sm:col-span-2" />
            </div>
          )}

          {signedIn && selected === "new" && (
            <SwitchField
              label="Save this address to my account"
              description="Use it next time in one tap"
              checked={saveAddress}
              onCheckedChange={setSaveAddress}
            />
          )}
        </div>

        {/* Step 2: Order items & optional note (fills the main column on desktop, sits above Price Summary on mobile) */}
        <div data-ui="store/CheckoutForm/div-flex-3" className="flex flex-1 flex-col gap-5 rounded-3xl border bg-card p-5 sm:p-7">
          <div data-ui="store/CheckoutForm/div-flex-4" className="flex flex-wrap items-center justify-between gap-2">
            <h2 data-ui="store/CheckoutForm/h2-your-order" className="flex items-center gap-2.5 text-xl sm:text-2xl font-semibold">
              <span data-ui="store/CheckoutForm/span-grid-2" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/12 font-sans text-xs font-bold text-primary">
                2
              </span>
              Your order
              <span data-ui="store/CheckoutForm/span-5" className="rounded-full bg-secondary px-2.5 py-0.5 font-sans text-xs font-semibold text-foreground/80">
                {shownCount} item{shownCount === 1 ? "" : "s"}
              </span>
            </h2>
            <Link data-ui="store/CheckoutForm/Link-edit-cart"
              href="/cart"
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
            >
              Edit cart
            </Link>
          </div>

          <ul data-ui="store/CheckoutForm/ul" className="space-y-3">
            {shown.map((l) => (
              <li data-ui="store/CheckoutForm/li" key={l.productId}>
                <Link
                  data-ui="store/CheckoutForm/Link-flex"
                  href={`/products/${l.slug}`}
                  className="group flex items-center gap-3.5 rounded-2xl border bg-background/60 p-3 transition-colors hover:border-primary/40 hover:bg-muted/40 sm:p-3.5"
                >
                  <div data-ui="store/CheckoutForm/div-relative" className="relative size-15 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                    <ProductImage src={l.image} alt={l.name} sizes="60px" className="transition-transform duration-300 ease-out group-hover:scale-105" />
                    <span data-ui="store/CheckoutForm/span-grid-3" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">
                      {l.quantity}
                    </span>
                  </div>
                  <span data-ui="store/CheckoutForm/span-6" className="min-w-0 flex-1 text-sm font-medium">
                    <span data-ui="store/CheckoutForm/span-7" className="line-clamp-2 transition-colors group-hover:text-primary">{l.name}</span>
                    <span data-ui="store/CheckoutForm/span-8" className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {formatPrice(l.price)} × {l.quantity}
                      {(l.shippingClass !== "standard" || l.weightGrams > 0) && (
                        <>
                          {" · "}
                          {[
                            l.shippingClass === "oversized" ? "Large / bulky" : l.shippingClass === "fragile" ? "Fragile" : null,
                            l.weightGrams > 0 ? formatWeightGrams(l.weightGrams * l.quantity) : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </>
                      )}
                    </span>
                  </span>
                  <span data-ui="store/CheckoutForm/span-9" className="shrink-0 text-sm font-semibold tabular-nums">{formatPrice(l.price * l.quantity)}</span>
                </Link>
              </li>
            ))}
          </ul>

          {!placeholder && hasUnavailable && (
            <p data-ui="store/CheckoutForm/p-3" className="text-xs text-destructive">Unavailable items were left out of this order.</p>
          )}

          <div data-ui="store/CheckoutForm/div-3" className="mt-auto space-y-3 border-t pt-4">
            <SwitchField
              label="Add an order note or gift message"
              description="Custom name, gift message, preferred colour…"
              checked={hasOrderNote || Boolean(errors.note)}
              onCheckedChange={(checked) => {
                setHasOrderNote(checked)
                if (!checked) {
                  form.setValue("note", "", { shouldValidate: true })
                }
              }}
            />
            {(hasOrderNote || Boolean(errors.note)) && (
              <TextAreaField
                label="Order note (optional)" maxLength={LIMITS.note.max}
                rows={2}
                placeholder="Write your gift message, custom name, or preferred colour…"
                error={errors.note?.message}
                {...form.register("note")}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right column (sticky on desktop, bottom summary card on mobile): Price breakdown & Pay CTA */}
      <aside data-ui="store/CheckoutForm/aside" className="h-fit space-y-5 rounded-3xl border bg-card p-5 sm:p-6 lg:sticky-store">
        <h2 data-ui="store/CheckoutForm/h2-price-summary" className="text-xl font-semibold">Price summary</h2>
        <FreeShippingBar subtotal={shownCharges.subtotal} />

        {/* Promo code section */}
        <div data-ui="store/CheckoutForm/div-4" className="space-y-2 border-t pt-4">
          {appliedPromo && !promoBelowMin ? (
            <div data-ui="store/CheckoutForm/div-flex-5" className="flex items-start justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-3 text-xs">
              <div data-ui="store/CheckoutForm/div-5" className="min-w-0 space-y-0.5">
                <p data-ui="store/CheckoutForm/p-flex" className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  <TicketPercentIcon className="size-4 shrink-0" aria-hidden />
                  <span data-ui="store/CheckoutForm/span-10" className="font-mono tracking-wider">{appliedPromo.code}</span>
                  <span data-ui="store/CheckoutForm/span-11">applied</span>
                </p>
                <p data-ui="store/CheckoutForm/p-4" className="text-muted-foreground">
                  {appliedPromo.description
                    ? `${appliedPromo.description} · Saving ${formatPrice(shownCharges.discountAmount ?? 0)}`
                    : `Saving ${formatPrice(shownCharges.discountAmount ?? 0)} on this order`}
                </p>
              </div>
              <button
                data-ui="store/CheckoutForm/button-remove"
                type="button"
                aria-label={`Remove promo code ${appliedPromo.code}`}
                onClick={handleRemovePromo}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <XIcon className="size-3.5" aria-hidden /> Remove
              </button>
            </div>
          ) : (
            <div data-ui="store/CheckoutForm/div-6" className="space-y-1.5">
              <div data-ui="store/CheckoutForm/div-flex-6" className="flex items-end gap-2">
                <TextField
                  label="Have a promo code?"
                  fieldSize="md"
                  noErrorSpace
                  containerClassName="min-w-0 flex-1"
                  value={promoInput}
                  maxLength={24}
                  disabled={promoPending || pending || placeholder}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                    if (promoError) setPromoError(null)
                    if (promoBelowMin) setAppliedPromo(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleApplyPromo()
                    }
                  }}
                  placeholder="Enter code (e.g. WELCOME10)"
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="font-mono text-xs font-semibold tracking-wider uppercase placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                />
                <Button
                  data-ui="store/CheckoutForm/Button"
                  type="button"
                  variant="outline"
                  disabled={promoPending || pending || placeholder || !promoInput.trim()}
                  onClick={handleApplyPromo}
                  className="shrink-0 rounded-xl px-4 text-xs font-semibold"
                >
                  {promoPending ? <Loader2Icon className="size-3.5 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {promoError && (
                <p data-ui="store/CheckoutForm/p-5" role="alert" className="text-xs font-medium text-destructive">
                  {promoError}
                </p>
              )}
              {promoBelowMin && appliedPromo && (
                <p data-ui="store/CheckoutForm/p-6" role="alert" className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Add {formatPrice(appliedPromo.minOrderAmount - baseCharges.subtotal)} more to use <span data-ui="store/CheckoutForm/span-12" className="font-mono font-bold">{appliedPromo.code}</span>.
                </p>
              )}
            </div>
          )}
        </div>

        <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Total to pay" className="border-t pt-4" />
        {serverError && (
          <p data-ui="store/CheckoutForm/p-7" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {serverError}
          </p>
        )}
        <Button data-ui="store/CheckoutForm/Button-hidden"
          type="submit"
          size="lg"
          disabled={pending || placeholder}
          className="hidden h-14 w-full flex-col gap-0.5 rounded-full py-1.5 shadow-lg shadow-primary/25 sm:inline-flex"
        >
          {pending ? (
            <span data-ui="store/CheckoutForm/span-inline-flex" className="inline-flex items-center gap-2 text-base font-semibold">
              <Loader2Icon className="size-5 animate-spin" /> Placing order…
            </span>
          ) : (
            <>
              <span data-ui="store/CheckoutForm/span-13" className="text-sm/tight font-semibold">Proceed to pay</span>
              <span data-ui="store/CheckoutForm/span-14" className="text-base/tight font-extrabold tracking-tight tabular-nums">{formatPrice(shownCharges.total)}</span>
            </>
          )}
        </Button>
        <div data-ui="store/CheckoutForm/div-7" className="space-y-2 rounded-xl bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
          <p data-ui="store/CheckoutForm/p-flex-2" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            <span data-ui="store/CheckoutForm/span-15">Order is placed after UPI payment</span>
          </p>
          <p data-ui="store/CheckoutForm/p-flex-3" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            <span data-ui="store/CheckoutForm/span-16" className="font-medium text-foreground/80">100% Safe Checkout</span>
          </p>
        </div>
      </aside>

      {/* Native e-commerce sticky bottom pay bar on phones */}
      <div
        data-ui="store/CheckoutForm/div-flex-7"
        data-mobile-bottom-bar
        className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border/80 bg-background/95 px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_-8px_rgb(0_0_0/0.16)] backdrop-blur-xl sm:hidden in-[data-skeleton]:hidden"
      >
        <Button
          data-ui="store/CheckoutForm/Button-2"
          type="submit"
          size="lg"
          disabled={pending || placeholder}
          className="h-13 min-w-0 w-full flex-col gap-0.5 rounded-full px-5 py-1.5 shadow-md shadow-primary/25 active:scale-97"
        >
          {pending ? (
            <span data-ui="store/CheckoutForm/span-inline-flex-2" className="inline-flex items-center gap-2 text-sm font-semibold">
              <Loader2Icon className="size-4 animate-spin" /> Placing order…
            </span>
          ) : (
            <>
              <span data-ui="store/CheckoutForm/span-17" className="text-sm/tight font-semibold">Proceed to pay</span>
              <span data-ui="store/CheckoutForm/span-18" className="text-sm/tight font-extrabold tracking-tight tabular-nums">{formatPrice(shownCharges.total)}</span>
            </>
          )}
        </Button>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={(next) => !pending && setPayDialogOpen(next)}>
        <DialogContent data-ui="store/CheckoutForm/DialogContent" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay {formatPrice(shownCharges.total)} to place your order</DialogTitle>
            <DialogDescription>
              Complete your UPI payment first, then enter your 12-digit UTR reference number below to place your order.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {(() => {
              const { upiId, upiPayeeName, orderCodePrefix } = shop
              const upiUrl = upiId
                ? buildUpiUrl({
                    upiId,
                    payeeName: upiPayeeName,
                    amount: shownCharges.total,
                    orderCode: orderCodePrefix || "Order",
                  })
                : null

              return (
                <>
                  {upiUrl && upiId ? (
                    <div data-ui="store/CheckoutForm/div-8" className="space-y-3.5">
                      <p data-ui="store/CheckoutForm/p-flex-4" className="flex items-center gap-2.5 text-sm font-semibold">
                        <span data-ui="store/CheckoutForm/span-grid-4" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                        Pay with any UPI app
                      </p>
                      <a data-ui="store/CheckoutForm/a-pay"
                        href={upiUrl}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.99] md:hidden"
                      >
                        <SmartphoneIcon className="size-4" /> Pay {formatPrice(shownCharges.total)} with UPI app
                      </a>
                      <button
                        data-ui="store/CheckoutForm/button-flex"
                        type="button"
                        onClick={() => setShowMobileQr((v) => !v)}
                        aria-expanded={showMobileQr}
                        className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-border/80 bg-background px-4 text-xs font-semibold text-foreground transition-colors hover:bg-muted/60 md:hidden"
                      >
                        <QrCodeIcon className="size-4 text-primary" />
                        {showMobileQr ? "Hide QR code" : "Show QR code (scan from another device)"}
                      </button>
                      <div
                        data-ui="store/CheckoutForm/div-9"
                        className={cn(
                          "items-center gap-4 rounded-2xl border border-border/80 bg-white p-3.5 shadow-2xs md:flex",
                          showMobileQr ? "flex" : "hidden",
                        )}
                      >
                        <div data-ui="store/CheckoutForm/div-10" className="shrink-0 rounded-xl border border-neutral-200/80 bg-white p-1.5">
                          <QRCodeSVG value={upiUrl} size={104} marginSize={0} title={`UPI QR code to pay ${formatPrice(shownCharges.total)}`} />
                        </div>
                        <div data-ui="store/CheckoutForm/div-11" className="space-y-1 text-sm text-neutral-700">
                          <p data-ui="store/CheckoutForm/p-flex-5" className="flex items-center gap-2 font-semibold text-neutral-900">
                            <QrCodeIcon className="size-4 text-primary" /> Scan with any UPI app
                          </p>
                          <p data-ui="store/CheckoutForm/p-8" className="text-xs/relaxed text-neutral-600">
                            Amount <strong data-ui="store/CheckoutForm/strong" className="font-semibold text-neutral-900">{formatPrice(shownCharges.total)}</strong> is pre-filled for you.
                          </p>
                        </div>
                      </div>

                      <div data-ui="store/CheckoutForm/div-12" className="space-y-2">
                        {[
                          { label: "UPI ID", value: upiId },
                          ...(upiPayeeName ? [{ label: "Name", value: upiPayeeName }] : []),
                          { label: "Amount", value: shownCharges.total.toFixed(2) },
                        ].map((row) => (
                          <div data-ui="store/CheckoutForm/div-flex-8" key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/45 px-3.5 py-2 text-xs">
                            <span data-ui="store/CheckoutForm/span-19" className="font-medium text-muted-foreground">{row.label}</span>
                            <span data-ui="store/CheckoutForm/span-flex-2" className="flex min-w-0 items-center gap-1.5 font-mono font-semibold text-foreground">
                              <span data-ui="store/CheckoutForm/span-20" className="truncate">{row.value}</span>
                              <button data-ui="store/CheckoutForm/button-grid"
                                type="button"
                                aria-label={`Copy ${row.label}`}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(row.value)
                                    toast.success("Copied")
                                  } catch {
                                    toast.error("Couldn't copy. Please select and copy it.")
                                  }
                                }}
                                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                              >
                                <CopyIcon className="size-3.5" />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p data-ui="store/CheckoutForm/p-9" className="rounded-2xl border bg-muted/50 p-4 text-sm/relaxed">
                      UPI details aren&apos;t configured yet.{" "}
                      <a data-ui="store/CheckoutForm/a-message-us-on-whatsapp"
                        href={shopWhatsappLink(shop, `Hi! I'd like to pay ${formatPrice(shownCharges.total)} and place my order.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline underline-offset-4"
                      >
                        Message us on WhatsApp
                      </a>{" "}
                      for payment details, then enter your UTR below.
                    </p>
                  )}

                  <div data-ui="store/CheckoutForm/div-13" className="space-y-3 border-t pt-4">
                    <p data-ui="store/CheckoutForm/p-flex-6" className="flex items-center gap-2.5 text-sm font-semibold">
                      <span data-ui="store/CheckoutForm/span-grid-5" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                      Enter your UTR / UPI reference number
                    </p>
                    <TextField
                      label="UTR / UPI reference number"
                      kind="paymentRef"
                      required
                      value={paymentRef}
                      onChange={(e) => {
                        setPaymentRef(e.target.value)
                        if (paymentRefError) setPaymentRefError(null)
                      }}
                      placeholder="e.g. 412345678901"
                      autoCapitalize="characters"
                      autoComplete="off"
                      hint="Found in your UPI app under payment details (usually a 12-digit number)."
                      error={paymentRefError ?? undefined}
                    />
                  </div>
                </>
              )
            })()}
            {serverError && (
              <p data-ui="store/CheckoutForm/p-10" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {serverError}
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button data-ui="store/CheckoutForm/Button-back"
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => setPayDialogOpen(false)}
              className="rounded-full px-5"
            >
              Back
            </Button>
            <Button data-ui="store/CheckoutForm/Button-3"
              type="button"
              size="lg"
              disabled={pending || !isPaymentRefValid}
              onClick={confirmPaymentAndPlaceOrder}
              className="gap-1.5 rounded-full px-6"
            >
              {pending && <Loader2Icon className="animate-spin" />}
              {pending ? "Placing order…" : "Confirm payment & place order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
  return preview || ready ? view : <Skeletonize>{view}</Skeletonize>
}

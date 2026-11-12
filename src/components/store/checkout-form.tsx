"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, CopyIcon, Loader2Icon, MapPinIcon, PlusIcon, QrCodeIcon, SmartphoneIcon } from "lucide-react"
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
import { placeOrder } from "@/features/orders/actions"
import { calculateCharges, formatWeightGrams } from "@/features/orders/pricing"
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
  const [hasOrderNote, setHasOrderNote] = useState(false)
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

  const [payDialogOpen, setPayDialogOpen] = useState(false)
  const [validatedCustomer, setValidatedCustomer] = useState<CheckoutInput | null>(null)
  const [paymentRef, setPaymentRef] = useState("")
  const [paymentRefError, setPaymentRefError] = useState<string | null>(null)

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
      const res = await placeOrder({
        customer: validatedCustomer,
        items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentReference: parsedRef.data,
        // only offer to save when the customer typed a new address
        saveAddress: Boolean(user) && selected === "new" && saveAddress,
      })
      if (!res.ok) {
        const refFieldMsg = res.fieldErrors?.paymentReference?.[0]
        if (refFieldMsg) {
          setPaymentRefError(refFieldMsg)
          toast.error(refFieldMsg)
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

  const hasAddressFieldError = Boolean(
    errors.name || errors.phone || errors.address || errors.pincode || errors.city || errors.state || area.error
  )
  const showAddressInputs = !user || addresses.length === 0 || selected === "new" || hasAddressFieldError

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
                {user ? (
                  addresses.length > 0 ? "Select a delivery address or add a new one." : "Enter where we should deliver."
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
              <Link
                data-ui="store/CheckoutForm/Link-manage-addresses"
                href="/account/profile"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                Manage addresses
              </Link>
            )}
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
              <TextField label="City" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
              <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName="sm:col-span-2" />
            </div>
          )}

          {user && selected === "new" && (
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
              <li data-ui="store/CheckoutForm/li-flex" key={l.productId} className="flex items-center gap-3.5 rounded-2xl border bg-background/60 p-3 sm:p-3.5">
                <div data-ui="store/CheckoutForm/div-relative" className="relative size-15 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                  <ProductImage src={l.image} alt={l.name} sizes="60px" />
                  <span data-ui="store/CheckoutForm/span-grid-3" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">
                    {l.quantity}
                  </span>
                </div>
                <span data-ui="store/CheckoutForm/span-6" className="min-w-0 flex-1 text-sm font-medium">
                  <span data-ui="store/CheckoutForm/span-7" className="line-clamp-2">{l.name}</span>
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
                <span data-ui="store/CheckoutForm/span-9" className="shrink-0 text-sm font-semibold">{formatPrice(l.price * l.quantity)}</span>
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
        <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Total to pay" className="border-t pt-4" />
        {serverError && (
          <p data-ui="store/CheckoutForm/p-4" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
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
          {pending ? "Placing order…" : `Proceed to pay · ${formatPrice(shownCharges.total)}`}
        </Button>
        <div data-ui="store/CheckoutForm/div-4" className="space-y-2 rounded-xl bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
          <p data-ui="store/CheckoutForm/p-flex" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            <span data-ui="store/CheckoutForm/span-10">Order is placed after UPI payment</span>
          </p>
          <p data-ui="store/CheckoutForm/p-flex-2" className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
            <span data-ui="store/CheckoutForm/span-11" className="font-medium text-foreground/80">100% Safe Checkout</span>
          </p>
        </div>
      </aside>

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
                    <div data-ui="store/CheckoutForm/div-5" className="space-y-3.5">
                      <p data-ui="store/CheckoutForm/p-flex-3" className="flex items-center gap-2.5 text-sm font-semibold">
                        <span data-ui="store/CheckoutForm/span-grid-4" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                        Pay with any UPI app
                      </p>
                      <a data-ui="store/CheckoutForm/a-pay"
                        href={upiUrl}
                        className="flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-transform active:scale-[0.99] md:hidden"
                      >
                        <SmartphoneIcon className="size-4" /> Pay {formatPrice(shownCharges.total)} with UPI app
                      </a>
                      <div data-ui="store/CheckoutForm/div-hidden" className="hidden items-center gap-4 rounded-2xl border border-border/80 bg-white p-3.5 shadow-2xs md:flex">
                        <div data-ui="store/CheckoutForm/div-6" className="shrink-0 rounded-xl border border-neutral-200/80 bg-white p-1.5">
                          <QRCodeSVG value={upiUrl} size={104} marginSize={0} title={`UPI QR code to pay ${formatPrice(shownCharges.total)}`} />
                        </div>
                        <div data-ui="store/CheckoutForm/div-7" className="space-y-1 text-sm text-neutral-700">
                          <p data-ui="store/CheckoutForm/p-flex-4" className="flex items-center gap-2 font-semibold text-neutral-900">
                            <QrCodeIcon className="size-4 text-primary" /> Scan with any UPI app
                          </p>
                          <p data-ui="store/CheckoutForm/p-5" className="text-xs leading-relaxed text-neutral-600">
                            Amount <strong data-ui="store/CheckoutForm/strong" className="font-semibold text-neutral-900">{formatPrice(shownCharges.total)}</strong> is pre-filled for you.
                          </p>
                        </div>
                      </div>

                      <div data-ui="store/CheckoutForm/div-8" className="space-y-2">
                        {[
                          { label: "UPI ID", value: upiId },
                          ...(upiPayeeName ? [{ label: "Name", value: upiPayeeName }] : []),
                          { label: "Amount", value: shownCharges.total.toFixed(2) },
                        ].map((row) => (
                          <div data-ui="store/CheckoutForm/div-flex-5" key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/45 px-3.5 py-2 text-xs">
                            <span data-ui="store/CheckoutForm/span-12" className="font-medium text-muted-foreground">{row.label}</span>
                            <span data-ui="store/CheckoutForm/span-flex-2" className="flex min-w-0 items-center gap-1.5 font-mono font-semibold text-foreground">
                              <span data-ui="store/CheckoutForm/span-13" className="truncate">{row.value}</span>
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
                    <p data-ui="store/CheckoutForm/p-6" className="rounded-2xl border bg-muted/50 p-4 text-sm leading-relaxed">
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

                  <div data-ui="store/CheckoutForm/div-9" className="space-y-3 border-t pt-4">
                    <p data-ui="store/CheckoutForm/p-flex-5" className="flex items-center gap-2.5 text-sm font-semibold">
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
            <Button data-ui="store/CheckoutForm/Button-2"
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

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { BanIcon, CheckCircle2Icon, Loader2Icon, MapPinIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { SwitchField, TextAreaField, TextField } from "@/components/form"
import { PriceBreakdown } from "@/components/shared/price-breakdown"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/account/actions"
import { listMyAddresses } from "@/features/addresses/actions"
import type { Address } from "@/features/addresses/types"
import { placeOrder } from "@/features/orders/actions"
import { checkoutSchema, type CheckoutInput } from "@/features/orders/schema"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useCart } from "@/store/cart"
import { FreeShippingBar } from "./cart-drawer"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { LIMITS } from "@/lib/validation"

export const LAST_ORDER_KEY = "kk-last-order"

export function CheckoutForm({ products }: { products: LiveProduct[] }) {
  const router = useRouter()
  const { ready, available, hasUnavailable, charges } = useLiveCart(products)
  const itemCount = available.reduce((n, l) => n + l.quantity, 0)
  const clearCart = useCart((s) => s.clear)
  const { user, ready: authReady } = useAuth()
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<Address[]>([])
  /** id of the saved address in use, or "new" when typing a different one */
  const [selected, setSelected] = useState<string>("new")
  const [saveAddress, setSaveAddress] = useState(true)

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: "", phone: "", address: "", city: "", pincode: "", note: "" },
  })
  const { errors } = form.formState

  const fillFrom = (a: Address) => {
    setSelected(a.id)
    form.reset({
      name: a.fullName,
      phone: a.phone,
      address: a.address,
      city: a.city,
      pincode: a.pincode,
      note: form.getValues("note"),
    })
  }

  const useNewAddress = () => {
    setSelected("new")
    const current = form.getValues()
    form.reset({ name: current.name, phone: current.phone, address: "", city: "", pincode: "", note: current.note })
  }

  // Signed-in customers: load the address book (default address pre-selected), else their profile name/phone.
  useEffect(() => {
    if (!authReady || !user) return
    let cancelled = false
    Promise.all([listMyAddresses(), getMyProfile()]).then(([list, profile]) => {
      if (cancelled) return
      setAddresses(list)
      const first = list[0]
      if (first) {
        setSelected(first.id)
        form.reset({
          name: first.fullName,
          phone: first.phone,
          address: first.address,
          city: first.city,
          pincode: first.pincode,
          note: form.getValues("note"),
        })
      } else if (profile) {
        const current = form.getValues()
        form.reset({ ...current, name: current.name || profile.fullName, phone: current.phone || profile.phone })
      }
    })
    return () => {
      cancelled = true
    }
  }, [authReady, user, form])

  const onSubmit = form.handleSubmit((values) => {
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

  if (!ready) return <Skeleton data-ui="store/CheckoutForm" className="h-128 rounded-3xl" />

  if (available.length === 0) {
    return (
      <div data-ui="store/CheckoutForm" className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
        <p data-ui="store/CheckoutForm/p" className="font-heading text-2xl">Your cart is empty</p>
        <Link data-ui="store/CheckoutForm/Link-browse-products" href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <form data-ui="store/CheckoutForm" onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px]">
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
          <TextField label="City" kind="city" autoComplete="address-level2" error={errors.city?.message} {...form.register("city")} />
          <TextField
            label="Pincode" kind="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            error={errors.pincode?.message}
            {...form.register("pincode")}
          />
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
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
        </h2>
        <ul data-ui="store/CheckoutForm/ul" className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {available.map((l) => (
            <li data-ui="store/CheckoutForm/li-flex" key={l.productId} className="flex items-center gap-3">
              <div data-ui="store/CheckoutForm/div-relative" className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                <ProductImage src={l.image} alt={l.name} sizes="56px" />
                <span data-ui="store/CheckoutForm/span-grid" className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">
                  {l.quantity}
                </span>
              </div>
              <span data-ui="store/CheckoutForm/span-5" className="flex-1 text-sm font-medium">
                <span data-ui="store/CheckoutForm/span-6" className="line-clamp-2">{l.name}</span>
                {l.fees.length > 0 && (
                  <span data-ui="store/CheckoutForm/span-7" className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    + {l.fees.map((f) => f.label.toLowerCase()).join(", ")} (once)
                  </span>
                )}
              </span>
              <span data-ui="store/CheckoutForm/span-8" className="text-sm font-semibold">{formatPrice(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        {hasUnavailable && (
          <p data-ui="store/CheckoutForm/p-4" className="text-xs text-destructive">Unavailable items were left out of this order.</p>
        )}
        <FreeShippingBar subtotal={charges.subtotal} />
        <PriceBreakdown {...charges} totalLabel="Total to pay" className="border-t pt-4" />
        {serverError && (
          <p data-ui="store/CheckoutForm/p-5" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {serverError}
          </p>
        )}
        <Button data-ui="store/CheckoutForm/Button"
          type="submit"
          size="lg"
          disabled={pending}
          className="h-13 w-full rounded-full text-base shadow-lg shadow-primary/25"
        >
          {pending ? <Loader2Icon className="size-5 animate-spin" /> : null}
          {pending ? "Placing order…" : `Place order & pay · ${formatPrice(charges.total)}`}
        </Button>
        <div data-ui="store/CheckoutForm/div-3" className="space-y-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <p data-ui="store/CheckoutForm/p-flex" className="flex items-start gap-2">
            <BanIcon className="mt-0.5 size-3.5 shrink-0" />
            <span data-ui="store/CheckoutForm/span-9">
              <span data-ui="store/CheckoutForm/span-10" className="font-semibold text-foreground">Cash on delivery isn&apos;t available.</span> You&apos;ll pay by UPI
              right after placing the order.
            </span>
          </p>
          <p data-ui="store/CheckoutForm/p-6" className="pl-5.5">Your order is confirmed once we verify the payment.</p>
        </div>
      </aside>
    </form>
  )
}

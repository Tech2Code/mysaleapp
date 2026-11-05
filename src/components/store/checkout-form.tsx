"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, LockIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { FormField } from "@/components/shared/form-field"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { getMyProfile } from "@/features/account/actions"
import { placeOrder } from "@/features/orders/actions"
import { checkoutSchema, type CheckoutInput } from "@/features/orders/schema"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { useCart } from "@/store/cart"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { WhatsAppIcon } from "./brand-icons"

export const LAST_ORDER_KEY = "kk-last-order"

export function CheckoutForm({ products }: { products: LiveProduct[] }) {
  const router = useRouter()
  const { ready, available, hasUnavailable, subtotal } = useLiveCart(products)
  const clearCart = useCart((s) => s.clear)
  const { user, ready: authReady } = useAuth()
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: "", phone: "", address: "", city: "", pincode: "", note: "" },
  })
  const { errors } = form.formState

  // Pre-fill saved delivery details for signed-in customers.
  useEffect(() => {
    if (!authReady || !user) return
    let cancelled = false
    getMyProfile().then((profile) => {
      if (cancelled || !profile) return
      const current = form.getValues()
      form.reset({
        name: current.name || profile.fullName,
        phone: current.phone || profile.phone,
        address: current.address || profile.address,
        city: current.city || profile.city,
        pincode: current.pincode || profile.pincode,
        note: current.note,
      })
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

  if (!ready) return <Skeleton className="h-[32rem] rounded-3xl" />

  if (available.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-20 text-center">
        <p className="font-heading text-2xl">Your cart is empty</p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6 rounded-3xl border bg-card p-5 sm:p-8">
        <div>
          <h2 className="text-2xl font-semibold">Delivery details</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {user ? (
              "We've filled in your saved details."
            ) : (
              <>
                Checking out as a guest.{" "}
                <Link href="/login?next=/checkout" className="font-medium text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>{" "}
                to save your address and track orders.
              </>
            )}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" error={errors.name?.message}>
            <Input autoComplete="name" className="h-11" {...form.register("name")} />
          </FormField>
          <FormField label="WhatsApp / mobile number" error={errors.phone?.message} hint="We'll confirm your order on this number">
            <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" className="h-11" {...form.register("phone")} />
          </FormField>
          <FormField label="Full address" error={errors.address?.message} className="sm:col-span-2">
            <Textarea autoComplete="street-address" rows={3} placeholder="House no., street, landmark" {...form.register("address")} />
          </FormField>
          <FormField label="City" error={errors.city?.message}>
            <Input autoComplete="address-level2" className="h-11" {...form.register("city")} />
          </FormField>
          <FormField label="Pincode" error={errors.pincode?.message}>
            <Input inputMode="numeric" autoComplete="postal-code" maxLength={6} className="h-11" {...form.register("pincode")} />
          </FormField>
          <FormField label="Note (optional)" error={errors.note?.message} hint="Gift message, custom name, preferred colour…" className="sm:col-span-2">
            <Textarea rows={2} {...form.register("note")} />
          </FormField>
        </div>
      </div>

      <aside className="h-fit space-y-5 rounded-3xl border bg-card p-6 lg:sticky lg:top-24">
        <h2 className="text-xl font-semibold">Your order</h2>
        <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {available.map((l) => (
            <li key={l.productId} className="flex items-center gap-3">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted @container">
                <ProductImage src={l.image} alt={l.name} sizes="56px" />
                <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-foreground text-[0.65rem] font-bold text-background">
                  {l.quantity}
                </span>
              </div>
              <span className="line-clamp-2 flex-1 text-sm font-medium">{l.name}</span>
              <span className="text-sm font-semibold">{formatPrice(l.price * l.quantity)}</span>
            </li>
          ))}
        </ul>
        {hasUnavailable && (
          <p className="text-xs text-destructive">Unavailable items were left out of this order.</p>
        )}
        <div className="flex items-baseline justify-between border-t pt-4">
          <span className="font-semibold">Total</span>
          <span className="font-heading text-3xl font-semibold">{formatPrice(subtotal)}</span>
        </div>
        {serverError && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {serverError}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-13 w-full rounded-full bg-whatsapp text-base text-white shadow-lg shadow-whatsapp/25 hover:bg-whatsapp/90"
        >
          {pending ? <Loader2Icon className="size-5 animate-spin" /> : <WhatsAppIcon className="size-5" />}
          {pending ? "Placing order…" : "Place order on WhatsApp"}
        </Button>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" />
          No online payment needed now. We&apos;ll confirm the order, delivery charges and payment with you on WhatsApp.
        </p>
      </aside>
    </form>
  )
}

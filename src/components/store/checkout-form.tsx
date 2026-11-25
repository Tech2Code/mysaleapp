"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2Icon, CopyIcon, Loader2Icon, MapPinIcon, PlusIcon, QrCodeIcon, SmartphoneIcon, TicketPercentIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
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
import { cancelOrder, createGatewayCheckoutSession, placeOrder, trackOrder, validatePromoCode, verifyGatewayPayment } from "@/features/orders/actions"
import { openGatewayCheckout } from "@/features/orders/gateway-client"
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
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { LegalQuickModal, type LegalDocTab } from "@/components/shared/cookie-banner"
import styles from "./checkout-form.module.css"

export const LAST_ORDER_KEY = "kk-last-order"
const EMPTY_ADDRESSES: Address[] = []

/** `preview`: render the placeholder form as-is; loading.tsx wraps it in <Skeletonize>. Before hydration it wraps itself. */
export function CheckoutForm({
  products,
  initialAddresses = EMPTY_ADDRESSES,
  initialProfile = null,
  initialUserId = null,
  preview = false,
}: {
  products: LiveProduct[]
  initialAddresses?: Address[]
  initialProfile?: Profile | null
  initialUserId?: string | null
  preview?: boolean
}) {
  const router = useRouter()
  const { ready, available, hasUnavailable, charges } = useLiveCart(products)
  const removeCartItem = useCart((s) => s.remove)
  const shop = useStoreSettings()
  const { user, ready: authReady } = useAuth()
  const ownerId = authReady ? (user?.id ?? null) : initialUserId
  const signedIn = Boolean(ownerId)
  const [pending, startTransition] = useTransition()
  const showBusySuccess = useBusySuccess()
  const [trackedOwnerId, setTrackedOwnerId] = useState<string | null>(initialUserId)
  const [clientAddresses, setClientAddresses] = useState<Address[] | null>(null)
  const [, setClientProfile] = useState<{ fullName: string; phone: string } | null>(null)
  const [clearedOnSignOut, setClearedOnSignOut] = useState(false)
  const canUseInitial = !clearedOnSignOut && (ownerId ?? null) === (initialUserId ?? null)
  const addresses = clearedOnSignOut ? (clientAddresses ?? []) : (clientAddresses ?? (canUseInitial ? initialAddresses : []))
  const initialDefault = canUseInitial ? initialAddresses[0] : undefined
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
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [legalModalTab, setLegalModalTab] = useState<LegalDocTab>("terms")
  const [redirecting, setRedirecting] = useState(false)
  const [frozenAvailable, setFrozenAvailable] = useState<typeof available | null>(null)
  useBlockWhile(pending || redirecting)
  const [promoPending, startPromoTransition] = useTransition()
  const fetchedForUser = useRef<string | null>(null)
  const prevUserId = useRef<string | null>(user?.id ?? null)
  const wasSignedIn = useRef(signedIn)

  if (ownerId !== trackedOwnerId) {
    setTrackedOwnerId(ownerId)
    setClientAddresses(ownerId ? null : [])
    setClientProfile(null)
    setClearedOnSignOut(!ownerId)
    setSelected("new")
    setSaveAddress(true)
    setHasOrderNote(false)
    setPayDialogOpen(false)
    setShowMobileQr(false)
    setValidatedCustomer(null)
    setPaymentRef("")
    setPaymentRefError(null)
    setPromoInput("")
    setAppliedPromo(null)
    setPromoError(null)
  }

  useEffect(() => {
    if (payDialogOpen) {
      router.prefetch("/order-placed")
    }
  }, [payDialogOpen, router])

  useLayoutEffect(() => {
    return () => {
      setPayDialogOpen(false)
      setShowMobileQr(false)
      setPaymentRef("")
      setPaymentRefError(null)
      setValidatedCustomer(null)
      setPromoError(null)
      setRedirecting(false)
      setFrozenAvailable(null)
    }
  }, [])

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
    const split = splitCityState(a.city)
    area.prime(a.pincode, split.city, split.state)
    form.reset({
      name: a.fullName,
      phone: a.phone,
      address: a.address,
      ...split,
      pincode: a.pincode,
      note: form.getValues("note"),
    })
  }

  const useNewAddress = () => {
    setSelected("new")
    area.prime("", "", NO_STATE)
    const current = form.getValues()
    form.reset({ name: current.name, phone: current.phone, address: "", city: "", state: NO_STATE, pincode: "", note: current.note })
  }

  const activeSavedAddress = signedIn && selected !== "new" ? addresses.find((a) => a.id === selected) : undefined
  const activeSavedKey = activeSavedAddress
    ? `${activeSavedAddress.id}:${activeSavedAddress.fullName}:${activeSavedAddress.phone}:${activeSavedAddress.address}:${activeSavedAddress.city}:${activeSavedAddress.pincode}`
    : ""

  // Pre-fill form when saved addresses load or the selected saved address updates
  useEffect(() => {
    if (activeSavedAddress) {
      if (form.formState.isDirty) return
      const split = splitCityState(activeSavedAddress.city)
      area.prime(activeSavedAddress.pincode, split.city, split.state)
      form.reset({
        name: activeSavedAddress.fullName,
        phone: activeSavedAddress.phone,
        address: activeSavedAddress.address,
        ...split,
        pincode: activeSavedAddress.pincode,
        note: form.getValues("note"),
      })
      return
    }
    if (form.formState.isDirty) return
    const first = canUseInitial ? initialAddresses[0] : undefined
    if (first && !form.getValues("address")) {
      queueMicrotask(() => setSelected(first.id))
      const split = splitCityState(first.city)
      area.prime(first.pincode, split.city, split.state)
      form.reset({
        name: first.fullName,
        phone: first.phone,
        address: first.address,
        ...split,
        pincode: first.pincode,
        note: form.getValues("note"),
      })
    } else if (!first && canUseInitial && initialProfile && (!form.getValues("name") || !form.getValues("phone"))) {
      const current = form.getValues()
      form.reset({
        ...current,
        name: current.name || initialProfile.fullName,
        phone: current.phone || initialProfile.phone,
      })
    }
  }, [activeSavedAddress, activeSavedKey, canUseInitial, initialAddresses, initialProfile, form, area])

  // Clear cached account addresses/autofill if the user signs out while CheckoutForm stays mounted
  useEffect(() => {
    if (signedIn) {
      wasSignedIn.current = true
      return
    }
    if (!authReady || !wasSignedIn.current) return
    wasSignedIn.current = false
    fetchedForUser.current = null
    area.prime("", "", NO_STATE)
    form.reset({ name: "", phone: "", address: "", city: "", state: NO_STATE, pincode: "", note: "" })
    queueMicrotask(() => {
      setClearedOnSignOut(true)
      setClientAddresses(null)
      setClientProfile(null)
      setSelected("new")
      setValidatedCustomer(null)
      setPayDialogOpen(false)
      setPaymentRef("")
      setPaymentRefError(null)
      setPromoInput("")
      setAppliedPromo(null)
      setPromoError(null)
    })
  }, [authReady, signedIn, form, area])

  // Signed-in customers: fallback if server did not preload addresses (or after sign-out/account switch)
  useEffect(() => {
    if (!authReady || !user) {
      prevUserId.current = null
      return
    }
    const switchedAccount =
      (prevUserId.current !== null && prevUserId.current !== user.id) || clearedOnSignOut
    prevUserId.current = user.id
    if (switchedAccount) {
      fetchedForUser.current = null
      form.reset({ name: "", phone: "", address: "", city: "", state: NO_STATE, pincode: "", note: "" })
    }
    if ((!switchedAccount && initialAddresses.length > 0) || fetchedForUser.current === user.id) return
    fetchedForUser.current = user.id
    let cancelled = false
    Promise.all([listMyAddresses(), getMyProfile()])
      .then(([list, profile]) => {
        if (cancelled) return
        setClearedOnSignOut(false)
        setClientAddresses(list)
        setClientProfile(profile ? { fullName: profile.fullName, phone: profile.phone } : null)
        if (!switchedAccount && form.formState.isDirty) return
        const first = list[0]
        if (first) {
          setSelected(first.id)
          form.reset({
            name: first.fullName,
            phone: first.phone,
            address: first.address,
            ...splitCityState(first.city),
            pincode: first.pincode,
            note: switchedAccount ? "" : form.getValues("note"),
          })
        } else if (profile) {
          const current = form.getValues()
          form.reset({
            ...(switchedAccount
              ? { address: "", city: "", state: NO_STATE, pincode: "", note: "" }
              : current),
            name: profile.fullName || (switchedAccount ? "" : current.name),
            phone: profile.phone || (switchedAccount ? "" : current.phone),
          })
        }
      })
      .catch(() => {
        fetchedForUser.current = null
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, form, initialAddresses.length, clearedOnSignOut])

  const runGatewayCheckout = (customerPayload: CheckoutInput) => {
    startTransition(async () => {
      try {
        const activeDiscount = computePromoDiscount(appliedPromo, charges.subtotal)
        const res = await createGatewayCheckoutSession({
          customer: customerPayload,
          items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          promoCode: appliedPromo && activeDiscount > 0 ? appliedPromo.code : undefined,
          expectedTotal: shownCharges.total,
          saveAddress: signedIn && selected === "new" && saveAddress,
        })
        if (!res.ok) {
          if (res.error.toLowerCase().includes("promo code")) {
            setAppliedPromo(null)
            setPromoError(res.error)
            toast.error(res.error)
            return
          }
          if (res.error.toLowerCase().includes("updated")) {
            toast.error(res.error)
            router.refresh()
            return
          }
          for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
            const msg = messages?.[0]
            if (msg && field in customerPayload) {
              form.setError(field as keyof CheckoutInput, { message: msg })
            }
          }
          toast.error(res.error)
          return
        }

        const outcome = await openGatewayCheckout(res.data.session)
        if (outcome.status === "dismissed" || outcome.status === "failed" || outcome.status === "unsupported") {
          // If the customer already completed payment (e.g. via QR) and the webhook confirmed it just before dismiss, do NOT cancel.
          if (outcome.status !== "unsupported") {
            const latest = await trackOrder({ code: res.data.orderCode, phoneLast4: res.data.phoneLast4 })
            if (latest.ok && latest.data.paymentStatus === "paid") {
              showBusySuccess("Payment confirmed!")
              setFrozenAvailable(available)
              setRedirecting(true)
              try {
                sessionStorage.setItem(
                  LAST_ORDER_KEY,
                  JSON.stringify({
                    orderCode: res.data.orderCode,
                    total: res.data.total,
                    phoneLast4: res.data.phoneLast4,
                    whatsappUrl: res.data.whatsappUrl,
                    paymentReference: latest.data.paymentReference ?? undefined,
                    paymentConfirmed: true,
                    createdAt: res.data.createdAt ?? new Date().toISOString(),
                  })
                )
              } catch {
                // private mode: the success page falls back to the code in the URL
              }
              for (const l of available) removeCartItem(l.productId)
              router.replace(`/order-placed?code=${encodeURIComponent(res.data.orderCode)}`)
              return
            }
          }
          await cancelOrder({
            code: res.data.orderCode,
            phoneLast4: res.data.phoneLast4,
            phone: customerPayload.phone,
            reason: outcome.status === "dismissed" ? "Payment cancelled at checkout" : "Payment could not be completed at checkout",
          })
          if (outcome.status === "dismissed") {
            toast.info("Payment was cancelled. Your cart is still saved.")
          } else {
            toast.error(outcome.error)
          }
          return
        }

        const verified = await verifyGatewayPayment({
          code: res.data.orderCode,
          phoneLast4: res.data.phoneLast4,
          gatewayOrderId: outcome.gatewayOrderId,
          paymentId: outcome.paymentId,
          signature: outcome.signature,
        })

        showBusySuccess(verified.ok ? "Payment confirmed!" : "Order placed!")
        setFrozenAvailable(available)
        setRedirecting(true)
        try {
          sessionStorage.setItem(
            LAST_ORDER_KEY,
            JSON.stringify({
              orderCode: res.data.orderCode,
              total: res.data.total,
              phoneLast4: res.data.phoneLast4,
              whatsappUrl: res.data.whatsappUrl,
              paymentReference: outcome.paymentId,
              paymentConfirmed: verified.ok && verified.data.confirmed,
              createdAt: res.data.createdAt ?? new Date().toISOString(),
            })
          )
        } catch {
          // private mode: the success page falls back to the code in the URL
        }
        for (const l of available) removeCartItem(l.productId)
        if (!verified.ok) {
          toast.info("Confirming your payment…")
        }
        router.replace(`/order-placed?code=${encodeURIComponent(res.data.orderCode)}`)
      } catch {
        toast.error("Couldn't start online payment. Please check your connection and try again.")
      }
    })
  }

  const onSubmit = form.handleSubmit((values) => {
    if (!activeSavedAddress && area.error) {
      form.setError("pincode", { message: area.error })
      return
    }
    const customerPayload: CheckoutInput = activeSavedAddress
      ? {
          name: activeSavedAddress.fullName,
          phone: activeSavedAddress.phone,
          address: activeSavedAddress.address,
          ...splitCityState(activeSavedAddress.city),
          pincode: activeSavedAddress.pincode,
          note: values.note,
        }
      : values
    if (shop.paymentMode === "gateway") {
      runGatewayCheckout(customerPayload)
      return
    }
    setPaymentRefError(null)
    setValidatedCustomer(customerPayload)
    setPayDialogOpen(true)
  })

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) {
      setPromoError("Enter a promo code")
      return
    }
    setPromoError(null)
    startPromoTransition(async () => {
      try {
        const res = await validatePromoCode({ code, subtotal: charges.subtotal })
        if (!res.ok) {
          setPromoError(res.error)
          toast.error(res.error)
          return
        }
        setAppliedPromo(res.data)
        setPromoInput("")
        toast.success(`Promo code ${res.data.code} applied! You saved ${formatPrice(res.data.discountAmount)}.`)
      } catch {
        setPromoError("Couldn't validate promo code. Please try again.")
        toast.error("Couldn't validate promo code. Please try again.")
      }
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
    startTransition(async () => {
      try {
        const activeDiscount = computePromoDiscount(appliedPromo, charges.subtotal)
        const res = await placeOrder({
          customer: validatedCustomer,
          items: available.map((l) => ({ productId: l.productId, quantity: l.quantity })),
          paymentReference: parsedRef.data,
          promoCode: appliedPromo && activeDiscount > 0 ? appliedPromo.code : undefined,
          expectedTotal: shownCharges.total,
          // only offer to save when the customer typed a new address
          saveAddress: signedIn && selected === "new" && saveAddress,
        })
        if (!res.ok) {
          const refFieldMsg = res.fieldErrors?.paymentReference?.[0]
          if (refFieldMsg) {
            setPaymentRefError(refFieldMsg)
            return
          }
          if (res.error.toLowerCase().includes("promo code")) {
            setAppliedPromo(null)
            setPromoError(res.error)
            setPayDialogOpen(false)
            toast.error(res.error)
            return
          }
          if (res.error.toLowerCase().includes("updated")) {
            setPayDialogOpen(false)
            toast.error(res.error)
            router.refresh()
            return
          }
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
        showBusySuccess("Order placed!")
        setFrozenAvailable(available)
        setRedirecting(true)
        try {
          sessionStorage.setItem(
            LAST_ORDER_KEY,
            JSON.stringify({
              ...res.data,
              paymentReference: res.data.paymentReference ?? parsedRef.data,
              createdAt: res.data.createdAt ?? new Date().toISOString(),
            })
          )
        } catch {
          // private mode: the success page falls back to the code in the URL
        }
        for (const l of available) removeCartItem(l.productId)
        router.replace(`/order-placed?code=${encodeURIComponent(res.data.orderCode)}`)
      } catch {
        toast.error("Couldn't place your order. Please check your connection and try again.")
      }
    })
  }

  // The real cart is in localStorage (unknown until hydration): show a placeholder order in the real layout meanwhile.
  // While redirecting to /order-placed, keep the snapshot of items/charges frozen so the dialog/page never flashes ₹0.
  const placeholder = !ready || preview
  const activeAvailable = redirecting && frozenAvailable ? frozenAvailable : available
  const shown = placeholder ? placeholderCartLines() : activeAvailable
  const baseCharges = placeholder || redirecting ? calculateCharges(shown, shop) : charges
  const shownCharges = placeholder ? baseCharges : applyPromoToCharges(baseCharges, appliedPromo)
  const shownCount = shown.reduce((n, l) => n + l.quantity, 0)
  const promoBelowMin = Boolean(
    !placeholder && appliedPromo && computePromoDiscount(appliedPromo, baseCharges.subtotal) <= 0
  )
  const promoEffectiveMin = appliedPromo ? Math.max(appliedPromo.minOrderAmount, 2) : 0
  const promoShortfall = appliedPromo
    ? Math.max(0.01, Math.round((promoEffectiveMin - baseCharges.subtotal + Number.EPSILON) * 100) / 100)
    : 0

  if (!placeholder && !redirecting && available.length === 0) {
    return (
      <div className={styles.emptyCartBox}>
        <p className={styles.emptyTitle}>Your cart is empty</p>
        <Link href="/products" className={cn(buttonVariants({ size: "lg" }), styles.browsePillBtn)}>
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
    <>
      <form onSubmit={onSubmit} noValidate className={styles.checkoutFormGrid}>
      <div className={styles.mainColumn}>
        {/* Step 1: Delivery details */}
        <div className={styles.stepCard}>
          <div className={styles.stepHeaderRow}>
            <div>
              <h2 className={styles.stepTitle}>
                <span className={styles.stepBadge}>
                  1
                </span>
                Delivery details
              </h2>
              <p className={styles.stepSubtext}>
                {signedIn ? (
                  addresses.length > 0 ? "Select a delivery address or add a new one." : "Enter where we should deliver."
                ) : authReady ? (
                  <>
                    Checking out as a guest.{" "}
                    <Link href="/login?next=/checkout" className={styles.inlineAccentLink}>
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

                href="/account/profile?tab=addresses"
                className={styles.smallActionLink}
              >
                Manage addresses
              </Link>
            )}
          </div>

          {signedIn && addresses.length > 0 && (
            <fieldset className={styles.addressFieldset}>
              <legend className={styles.srOnly}>Saved addresses</legend>
              <div className={styles.savedAddrGrid}>
                {addresses.map((a) => {
                  const active = selected === a.id
                  return (
                    <label
                      key={a.id}
                      className={cn(
                        styles.savedAddrCard,
                        active && styles.savedAddrCardActive
                      )}
                    >
                      <input type="radio" name="saved-address" className={styles.srOnly} checked={active} onChange={() => fillFrom(a)} />
                      <span className={styles.addrTitleRow}>
                        <MapPinIcon className={styles.pinSvg} aria-hidden /> {a.label}
                        {a.isDefault && <span className={styles.defaultBadge}>Default</span>}
                        {active && <CheckCircle2Icon className={styles.activeCheckSvg} aria-hidden />}
                      </span>
                      <span className={styles.addrPersonLine}>
                        {a.fullName} <span className={styles.addrPhoneMuted}>· +91 {a.phone}</span>
                      </span>
                      <span className={styles.addrStreetLine}>
                        {a.address}, {a.city} - {a.pincode}
                      </span>
                    </label>
                  )
                })}
                <button
                  type="button"
                  onClick={useNewAddress}
                  aria-pressed={selected === "new"}
                  className={cn(
                    styles.addNewAddrBtn,
                    selected === "new" && styles.addNewAddrBtnActive
                  )}
                >
                  <PlusIcon className={styles.plusSvg} /> Add new address
                </button>
              </div>
            </fieldset>
          )}

          {showAddressInputs && (
            <div className={styles.addressFieldsGrid}>
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
                containerClassName={styles.spanTwoCols}
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
              <FormSelectField control={form.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName={styles.spanTwoCols} />
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
        <div className={styles.orderStepCard}>
          <div className={styles.stepHeaderCenterRow}>
            <h2 className={styles.stepTitle}>
              <span className={styles.stepBadge}>
                2
              </span>
              Your order
              <span className={styles.itemCountPill}>
                {shownCount} item{shownCount === 1 ? "" : "s"}
              </span>
            </h2>
            <Link
              href="/cart"
              className={styles.smallActionLink}
            >
              Edit cart
            </Link>
          </div>

          <ul className={styles.orderItemsUl}>
            {shown.map((l) => (
              <li key={l.productId}>
                <Link

                  href={`/products/${l.slug}`}
                  className={styles.orderLineLink}
                >
                  <div className={styles.lineThumbWrap}>
                    <ProductImage src={l.image} alt={l.name} sizes="60px" className={styles.lineThumbImg} />
                    <span className={styles.qtyBubble}>
                      {l.quantity}
                    </span>
                  </div>
                  <span className={styles.lineTextCol}>
                    <span className={styles.lineNameText}>{l.name}</span>
                    <span className={styles.lineMetaText}>
                      {formatPrice(l.price)} × {l.quantity}
                      {l.priceChanged && " · Price updated"}
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
                  <span className={styles.lineTotalPrice}>{formatPrice(l.price * l.quantity)}</span>
                </Link>
              </li>
            ))}
          </ul>

          {!placeholder && hasUnavailable && (
            <p className={styles.unavailableWarning}>Unavailable items were left out of this order.</p>
          )}

          <div className={styles.noteFooterSection}>
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
      <aside className={styles.summaryAside}>
        <h2 className={styles.summaryHeading}>Price summary</h2>
        <FreeShippingBar subtotal={shownCharges.subtotal} />

        {/* Promo code section */}
        <div className={styles.promoSection}>
          {appliedPromo && !promoBelowMin ? (
            <div className={styles.appliedPromoCard}>
              <div className={styles.promoInfoCol}>
                <p className={styles.promoCodeRow}>
                  <TicketPercentIcon className={styles.ticketSvg} aria-hidden />
                  <span className={styles.monoCode}>{appliedPromo.code}</span>
                  <span>applied</span>
                </p>
                <p className={styles.promoSavingsNote}>
                  {appliedPromo.description
                    ? `${appliedPromo.description} · Saving ${formatPrice(shownCharges.discountAmount ?? 0)}`
                    : `Saving ${formatPrice(shownCharges.discountAmount ?? 0)} on this order`}
                </p>
              </div>
              <button

                type="button"
                aria-label={`Remove promo code ${appliedPromo.code}`}
                onClick={handleRemovePromo}
                className={styles.removePromoBtn}
              >
                <XIcon className={styles.xSmallSvg} aria-hidden /> Remove
              </button>
            </div>
          ) : (
            <div className={styles.promoInputStack}>
              <div className={styles.promoInputRow}>
                <TextField
                  label="Have a promo code?"
                  fieldSize="md"
                  noErrorSpace
                  containerClassName={styles.promoFieldContainer}
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
                  className={styles.promoCodeInput}
                />
                <Button

                  type="button"
                  variant="outline"
                  disabled={promoPending || pending || placeholder || !promoInput.trim()}
                  onClick={handleApplyPromo}
                  className={styles.applyPromoBtn}
                >
                  {promoPending ? <Loader2Icon className={styles.spinSmallSvg} /> : "Apply"}
                </Button>
              </div>
              {promoError && (
                <p role="alert" className={styles.promoErrorMsg}>
                  {promoError}
                </p>
              )}
              {promoBelowMin && appliedPromo && (
                <div className={styles.promoBelowMinRow}>
                  <p role="alert" className={styles.promoBelowMinMsg}>
                    Add {formatPrice(promoShortfall)} more to use <span className={styles.monoBold}>{appliedPromo.code}</span>.
                  </p>
                  <button

                    type="button"
                    onClick={handleRemovePromo}
                    className={styles.removeInlineBtn}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Total to pay" className={styles.breakdownTopBorder} />
        <Button
          type="submit"
          size="lg"
          disabled={pending || placeholder}
          className={styles.desktopPayBtn}
        >
          {pending ? (
            <span className={styles.payBtnBusySpan}>
              <Loader2Icon className={styles.spinMdSvg} /> Placing order…
            </span>
          ) : (
            <>
              <span className={styles.payBtnTopLine}>Proceed to pay</span>
              <span className={styles.payBtnAmountLine}>{formatPrice(shownCharges.total)}</span>
            </>
          )}
        </Button>
        <div className={styles.trustChecklistBox}>
          <p className={styles.trustRow}>
            <CheckCircle2Icon className={styles.checkSvg} />
            <span>{shop.paymentMode === "gateway" ? "Instant confirmation via secure gateway" : "Order is placed after UPI payment"}</span>
          </p>
          <p className={styles.trustRow}>
            <CheckCircle2Icon className={styles.checkSvg} />
            <span className={styles.safeText}>100% Safe Checkout</span>
          </p>
          <p className={styles.policyNoteLine}>
            By placing your order, you agree to our{" "}
            <button

              type="button"
              onClick={() => {
                setLegalModalTab("terms")
                setLegalModalOpen(true)
              }}
              className={styles.policyInlineLink}
            >
              Terms
            </button>
            ,{" "}
            <button

              type="button"
              onClick={() => {
                setLegalModalTab("privacy")
                setLegalModalOpen(true)
              }}
              className={styles.policyInlineLink}
            >
              Privacy
            </button>{" "}
            &amp;{" "}
            <button

              type="button"
              onClick={() => {
                setLegalModalTab("refund")
                setLegalModalOpen(true)
              }}
              className={styles.policyInlineLink}
            >
              Refund Policy
            </button>
            .
          </p>
        </div>
      </aside>

      {/* Native e-commerce sticky bottom pay bar on phones */}
      <div

        data-mobile-bottom-bar
        className={cn(styles.mobileBottomBar, "glass")}
      >
        <Button

          type="submit"
          size="lg"
          disabled={pending || placeholder}
          className={styles.mobilePayBtn}
        >
          {pending ? (
            <span className={styles.mobilePayBusySpan}>
              <Loader2Icon className={styles.spinSmSvg} /> Placing order…
            </span>
          ) : (
            <>
              <span className={styles.payBtnTopLine}>Proceed to pay</span>
              <span className={styles.mobilePayAmountLine}>{formatPrice(shownCharges.total)}</span>
            </>
          )}
        </Button>
      </div>
    </form>

    <LegalQuickModal open={legalModalOpen} onOpenChange={setLegalModalOpen} initialTab={legalModalTab} />

    <Dialog
        open={payDialogOpen}
        onOpenChange={(next) => {
          if (pending) return
          setPayDialogOpen(next)
          if (!next) {
            setPaymentRefError(null)
            setShowMobileQr(false)
          }
        }}
      >
        <DialogContent mobileFullScreen className={styles.payDialogContent}>
          <DialogHeader>
            <DialogTitle>Pay {formatPrice(shownCharges.total)} to place your order</DialogTitle>
            <DialogDescription>
              Complete your UPI payment first, then enter your 12-digit UTR reference number below to place your order.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={styles.payDialogBody}>
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
                    <div className={styles.upiStepBlock}>
                      <p className={styles.dialogStepHeading}>
                        <span className={styles.solidStepNum}>1</span>
                        Pay with any UPI app
                      </p>
                      <a
                        href={upiUrl}
                        className={styles.upiDeepLinkBtn}
                      >
                        <SmartphoneIcon className={styles.phoneSvg} /> Pay {formatPrice(shownCharges.total)} with UPI app
                      </a>
                      <button

                        type="button"
                        onClick={() => setShowMobileQr((v) => !v)}
                        aria-expanded={showMobileQr}
                        className={styles.qrToggleBtn}
                      >
                        <QrCodeIcon className={styles.qrSvg} />
                        {showMobileQr ? "Hide QR code" : "Show QR code (scan from another device)"}
                      </button>
                      <div

                        className={cn(
                          styles.qrCardRow,
                          showMobileQr && styles.qrCardRowVisible,
                        )}
                      >
                        <div className={styles.qrWhiteFrame}>
                          <QRCodeSVG value={upiUrl} size={104} marginSize={0} title={`UPI QR code to pay ${formatPrice(shownCharges.total)}`} />
                        </div>
                        <div className={styles.qrCopyCol}>
                          <p className={styles.qrCopyTitle}>
                            <QrCodeIcon className={styles.qrSvg} /> Scan with any UPI app
                          </p>
                          <p className={styles.qrCopySub}>
                            Amount <strong className={styles.strongFg}>{formatPrice(shownCharges.total)}</strong> is pre-filled for you.
                          </p>
                        </div>
                      </div>

                      <div className={styles.upiCopyRowsList}>
                        {[
                          { label: "UPI ID", value: upiId },
                          ...(upiPayeeName ? [{ label: "Name", value: upiPayeeName }] : []),
                          { label: "Amount", value: shownCharges.total.toFixed(2) },
                        ].map((row) => (
                          <div key={row.label} className={styles.upiCopyRow}>
                            <span className={styles.upiRowLabel}>{row.label}</span>
                            <span className={styles.upiRowValueWrap}>
                              <span className={styles.upiValueTrunc}>{row.value}</span>
                              <button
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
                                className={styles.copyMiniBtn}
                              >
                                <CopyIcon className={styles.copyTinySvg} />
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className={styles.upiMissingNotice}>
                      UPI details aren&apos;t configured yet.{" "}
                      <a
                        href={shopWhatsappLink(shop, `Hi! I'd like to pay ${formatPrice(shownCharges.total)} and place my order.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.waAccentLink}
                      >
                        Message us on WhatsApp
                      </a>{" "}
                      for payment details, then enter your UTR below.
                    </p>
                  )}

                  <div className={styles.utrStepSection}>
                    <p className={styles.dialogStepHeading}>
                      <span className={styles.solidStepNum}>2</span>
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!pending) confirmPaymentAndPlaceOrder()
                        }
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
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={pending}
              onClick={() => setPayDialogOpen(false)}
              className={styles.footerBackBtn}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={pending}
              onClick={confirmPaymentAndPlaceOrder}
              className={styles.footerConfirmBtn}
            >
              {pending && <Loader2Icon className={styles.spinSmSvg} />}
              {pending ? "Placing order…" : "Confirm payment & place order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
  return preview || ready ? view : <Skeletonize>{view}</Skeletonize>
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  CreditCardIcon,
  HomeIcon,
  Loader2Icon,
  LockIcon,
  MapPinIcon,
  PencilIcon,
  PlusIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  TagIcon,
  TicketPercentIcon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { FormSelectField, SwitchField, TextAreaField, TextField } from "@/components/form"
import { joinCityState, NO_STATE, splitCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
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
import { SegmentedTabs, type SegmentedTabItem } from "@/components/shared/segmented-tabs"
import { getMyProfile } from "@/features/account/actions"
import type { Profile } from "@/features/account/schema"
import { listMyAddresses, saveAddress as saveAccountAddress } from "@/features/addresses/actions"
import { ADDRESS_LABELS, MAX_ADDRESSES, type Address } from "@/features/addresses/types"
import { cancelOrder, createGatewayCheckoutSession, placeOrder, trackOrder, validatePromoCode, verifyGatewayPayment } from "@/features/orders/actions"
import { openGatewayCheckout } from "@/features/orders/gateway-client"
import { applyPromoToCharges, calculateCharges, computePromoDiscount, formatWeightGrams, type ValidatedPromo } from "@/features/orders/pricing"
import { placeholderCartLines } from "@/features/products/placeholders"
import { checkoutSchema, paymentReferenceSchema, type CheckoutInput } from "@/features/orders/schema"
import { buildUpiUrl } from "@/features/orders/upi"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatPrice, normalizeIndianPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { cartLineKey, useCart } from "@/store/cart"
import { useStoreSettings } from "./store-settings-provider"
import { FreeShippingBar } from "./cart-drawer"
import { useLiveCart, type LiveProduct } from "./live-cart"
import { ProductImage } from "./product-image"
import { LIMITS } from "@/lib/validation"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { LegalQuickModal, type LegalDocTab } from "@/components/shared/cookie-banner"
import { useStepHistory } from "@/hooks/use-step-history"
import styles from "./checkout-form.module.css"

export const LAST_ORDER_KEY = "kk-last-order"
const CHECKOUT_DRAFT_KEY = "kk-checkout-draft"
const CHECKOUT_DRAFT_TTL_MS = 30 * 60 * 1000
const EMPTY_ADDRESSES: Address[] = []

type CheckoutStep = 1 | 2 | 3

type CheckoutDraft = {
  ownerId: string | null
  step: CheckoutStep
  selectedId: string
  oneTimeAddress: OneTimeAddress | null
  appliedPromo: ValidatedPromo | null
  formValues: CheckoutInput
  savedAt: number
}

function isNonEmptyStr(v: unknown): v is string {
  return typeof v === "string"
}

function sanitizeOneTimeAddress(raw: unknown): OneTimeAddress | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (
    !isNonEmptyStr(r.fullName) ||
    !isNonEmptyStr(r.phone) ||
    !isNonEmptyStr(r.address) ||
    !isNonEmptyStr(r.city) ||
    !isNonEmptyStr(r.state) ||
    !isNonEmptyStr(r.pincode)
  ) {
    return null
  }
  return {
    fullName: r.fullName,
    phone: r.phone,
    address: r.address,
    city: r.city,
    state: r.state as IndianState,
    pincode: r.pincode,
  }
}

function sanitizeAppliedPromo(raw: unknown): ValidatedPromo | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.code !== "string" ||
    (r.discountType !== "percent" && r.discountType !== "flat") ||
    typeof r.discountValue !== "number" ||
    !Number.isFinite(r.discountValue) ||
    typeof r.minOrderAmount !== "number" ||
    !Number.isFinite(r.minOrderAmount) ||
    (r.maxDiscountAmount !== null && (typeof r.maxDiscountAmount !== "number" || !Number.isFinite(r.maxDiscountAmount))) ||
    typeof r.discountAmount !== "number" ||
    !Number.isFinite(r.discountAmount)
  ) {
    return null
  }
  return {
    code: r.code,
    description: typeof r.description === "string" ? r.description : null,
    discountType: r.discountType,
    discountValue: r.discountValue,
    minOrderAmount: r.minOrderAmount,
    maxDiscountAmount: r.maxDiscountAmount as number | null,
    discountAmount: r.discountAmount,
  }
}

function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>
    if (!parsed || typeof parsed !== "object") {
      clearCheckoutDraft()
      return null
    }
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > CHECKOUT_DRAFT_TTL_MS) {
      clearCheckoutDraft()
      return null
    }
    if (parsed.step !== 1 && parsed.step !== 2 && parsed.step !== 3) {
      clearCheckoutDraft()
      return null
    }
    if (!parsed.formValues || typeof parsed.formValues !== "object") {
      clearCheckoutDraft()
      return null
    }
    const fv = parsed.formValues as Record<string, unknown>
    const formValues: CheckoutInput = {
      name: typeof fv.name === "string" ? fv.name : "",
      phone: typeof fv.phone === "string" ? fv.phone : "",
      address: typeof fv.address === "string" ? fv.address : "",
      city: typeof fv.city === "string" ? fv.city : "",
      state: typeof fv.state === "string" ? (fv.state as IndianState) : ("" as IndianState),
      pincode: typeof fv.pincode === "string" ? fv.pincode : "",
      note: typeof fv.note === "string" ? fv.note : "",
    }
    return {
      ownerId: typeof parsed.ownerId === "string" ? parsed.ownerId : null,
      step: parsed.step,
      selectedId: typeof parsed.selectedId === "string" ? parsed.selectedId : "new",
      oneTimeAddress: sanitizeOneTimeAddress(parsed.oneTimeAddress),
      appliedPromo: sanitizeAppliedPromo(parsed.appliedPromo),
      formValues,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    }
  } catch {
    clearCheckoutDraft()
    return null
  }
}

function writeCheckoutDraft(draft: CheckoutDraft) {
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft))
  } catch {}
}

function clearCheckoutDraft() {
  try {
    sessionStorage.removeItem(CHECKOUT_DRAFT_KEY)
  } catch {}
}

const CHECKOUT_STEPS: { step: CheckoutStep; label: string; shortLabel: string; mobileTitle: string }[] = [
  { step: 1, label: "Delivery", shortLabel: "Address", mobileTitle: "Delivery address" },
  { step: 2, label: "Order Summary", shortLabel: "Summary", mobileTitle: "Order summary" },
  { step: 3, label: "Payment", shortLabel: "Payment", mobileTitle: "Payment" },
]

type OneTimeAddress = {
  fullName: string
  phone: string
  address: string
  city: string
  state: IndianState
  pincode: string
}

function CheckoutAddressModalBody({
  initial,
  canSaveMore,
  saving,
  openedFromList,
  onBackToList,
  onCancel,
  onSubmitAddress,
}: {
  initial: { fullName: string; phone: string; address?: string; city?: string; state?: IndianState; pincode?: string }
  canSaveMore: boolean
  saving: boolean
  openedFromList: boolean
  onBackToList: () => void
  onCancel: () => void
  onSubmitAddress: (values: CheckoutInput, opts: { saveToAccount: boolean; label: (typeof ADDRESS_LABELS)[number] }) => void
}) {
  const [saveToAccount, setSaveToAccount] = useState(canSaveMore && !initial.address)
  const [label, setLabel] = useState<(typeof ADDRESS_LABELS)[number]>("Home")
  const addrForm = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: initial.fullName,
      phone: initial.phone,
      address: initial.address ?? "",
      city: initial.city ?? "",
      state: initial.state ?? NO_STATE,
      pincode: initial.pincode ?? "",
      note: "",
    },
  })
  const { errors } = addrForm.formState
  const modalArea = usePincodeLookup({
    pincode: useWatch({ control: addrForm.control, name: "pincode" }) ?? "",
    getCity: () => addrForm.getValues("city"),
    setCity: (city) => addrForm.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => addrForm.getValues("state"),
    setState: (state) => addrForm.setValue("state", state as IndianState, { shouldValidate: true, shouldDirty: true }),
  })

  const handleSave = addrForm.handleSubmit((values) => {
    if (modalArea.error) {
      addrForm.setError("pincode", { message: modalArea.error })
      return
    }
    onSubmitAddress(values, { saveToAccount: canSaveMore && saveToAccount, label })
  })

  return (
    <form onSubmit={handleSave} noValidate className={styles.addrModalForm}>
      <DialogBody className={styles.addrModalBody}>
        {canSaveMore && saveToAccount && (
          <div className={styles.labelChipsGroup}>
            <span className={styles.labelChipsCaption}>Save as</span>
            <SegmentedTabs
              role="group"
              ariaLabel="Save address as"
              layout="equal"
              surface="card"
              shape="rounded"
              items={[
                { value: "Home", label: "Home", icon: HomeIcon },
                { value: "Work", label: "Work", icon: BriefcaseIcon },
                { value: "Other", label: "Other", icon: MapPinIcon },
              ] satisfies readonly SegmentedTabItem<(typeof ADDRESS_LABELS)[number]>[]}
              value={label}
              onChange={setLabel}
            />
          </div>
        )}
        <div className={styles.addressFieldsGrid}>
          <TextField label="Full name" kind="personName" autoComplete="name" error={errors.name?.message} {...addrForm.register("name")} />
          <TextField
            label="WhatsApp / mobile number"
            kind="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            leading="+91"
            error={errors.phone?.message}
            {...addrForm.register("phone")}
          />
          <TextAreaField
            label="Full address"
            maxLength={LIMITS.address.max}
            autoComplete="street-address"
            rows={3}
            placeholder="House no., street, landmark"
            containerClassName={styles.spanTwoCols}
            error={errors.address?.message}
            {...addrForm.register("address")}
          />
          <TextField
            label="Pincode"
            kind="pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            hint={modalArea.hint}
            error={errors.pincode?.message || modalArea.error}
            {...addrForm.register("pincode")}
          />
          <TextField label="City / District" kind="city" autoComplete="address-level2" error={errors.city?.message} {...addrForm.register("city")} />
          <FormSelectField control={addrForm.control} name="state" label="State" placeholder="Select state" options={STATE_OPTIONS} containerClassName={styles.spanTwoCols} />
        </div>
        {canSaveMore ? (
          <SwitchField
            label="Save this address to my account"
            description="Pick it in one tap on future orders"
            checked={saveToAccount}
            onCheckedChange={setSaveToAccount}
          />
        ) : (
          <p className={styles.addrLimitNote}>
            You have reached the {MAX_ADDRESSES} saved address limit. This address will be used for this order only.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        {openedFromList ? (
          <Button type="button" variant="outline" size="lg" disabled={saving} onClick={onBackToList} className={styles.footerBackBtn}>
            <ArrowLeftIcon className={styles.icon16} /> Back
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" disabled={saving} onClick={onCancel} className={styles.footerBackBtn}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="lg" disabled={saving} className={styles.footerConfirmBtn}>
          {saving ? <Loader2Icon className={styles.spinSmSvg} /> : <CheckIcon className={styles.icon16} />}
          {saving ? "Saving…" : canSaveMore && saveToAccount ? "Save & deliver here" : "Deliver to this address"}
        </Button>
      </DialogFooter>
    </form>
  )
}

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
  const [step, setStep] = useState<CheckoutStep>(1)
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false)
  const stepRafRef = useRef<number>(0)
  const utrRafRef = useRef<number>(0)
  const utrTimerRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (stepRafRef.current) window.cancelAnimationFrame(stepRafRef.current)
      if (utrRafRef.current) window.cancelAnimationFrame(utrRafRef.current)
      if (utrTimerRef.current) window.clearTimeout(utrTimerRef.current)
    }
  }, [])

  const applyStep = useCallback((next: CheckoutStep) => {
    setStep(next)
    setMobileSummaryOpen(false)
    if (stepRafRef.current) window.cancelAnimationFrame(stepRafRef.current)
    stepRafRef.current = window.requestAnimationFrame(() => {
      stepRafRef.current = 0
      stepperTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      stepHeadingRef.current?.focus({ preventScroll: true })
    })
  }, [])
  const { goToStep: moveToStep, resetHistoryDepth, syncHistoryDepth } = useStepHistory<CheckoutStep>({
    pathname: "/checkout",
    stateKey: "checkoutStep",
    step,
    minStep: 1,
    maxStep: 3,
    onStepChange: applyStep,
  })
  const [promoOpen, setPromoOpen] = useState(false)
  const [trackedOwnerId, setTrackedOwnerId] = useState<string | null>(initialUserId)
  const [clientAddresses, setClientAddresses] = useState<Address[] | null>(null)
  const [clientProfile, setClientProfile] = useState<{ fullName: string; phone: string } | null>(null)
  const [clearedOnSignOut, setClearedOnSignOut] = useState(false)
  const canUseInitial = !clearedOnSignOut && (ownerId ?? null) === (initialUserId ?? null)
  const activeProfile = clientProfile ?? (canUseInitial ? initialProfile : null)
  const addresses = useMemo(
    () => (clearedOnSignOut ? (clientAddresses ?? []) : (clientAddresses ?? (canUseInitial ? initialAddresses : []))),
    [clearedOnSignOut, clientAddresses, canUseInitial, initialAddresses]
  )
  const initialDefault = canUseInitial ? initialAddresses[0] : undefined
  /** id of the saved address in use, or "new" when typing a different one */
  const [selectedId, setSelected] = useState<string>(initialDefault ? initialDefault.id : "new")
  const selected = selectedId === "new" || addresses.some((a) => a.id === selectedId) ? selectedId : (addresses[0]?.id ?? "new")
  const [saveAddress, setSaveAddress] = useState(true)
  const [oneTimeAddress, setOneTimeAddress] = useState<OneTimeAddress | null>(null)
  const [addressModal, setAddressModal] = useState<null | "list" | "new">(null)
  const [openedNewFromList, setOpenedNewFromList] = useState(false)
  const [editingOneTime, setEditingOneTime] = useState(false)
  const [addrModalKey, setAddrModalKey] = useState(0)
  const [savingAddr, startSaveAddr] = useTransition()
  const [hasOrderNote, setHasOrderNote] = useState(false)
  const [showMobileQr, setShowMobileQr] = useState(false)
  const [paymentRef, setPaymentRef] = useState("")
  const [paymentRefError, setPaymentRefError] = useState<string | null>(null)
  const [promoInput, setPromoInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [legalModalOpen, setLegalModalOpen] = useState(false)
  const [legalModalTab, setLegalModalTab] = useState<LegalDocTab>("terms")
  const [redirecting, setRedirecting] = useState(false)
  const [frozenAvailable, setFrozenAvailable] = useState<typeof available | null>(null)
  useBlockWhile(pending || redirecting || savingAddr)
  const [promoPending, startPromoTransition] = useTransition()
  const fetchedForUser = useRef<string | null>(null)
  const prevUserId = useRef<string | null>(user?.id ?? null)
  const wasSignedIn = useRef(signedIn)
  const stepperTopRef = useRef<HTMLDivElement>(null)
  const stepHeadingRef = useRef<HTMLHeadingElement>(null)
  const utrInputRef = useRef<HTMLDivElement>(null)
  const restoredDraftRef = useRef(false)
  const draftReadyToPersistRef = useRef(false)

  const focusUtrInput = useCallback(() => {
    if (typeof window === "undefined") return
    if (utrRafRef.current) window.cancelAnimationFrame(utrRafRef.current)
    if (utrTimerRef.current) window.clearTimeout(utrTimerRef.current)
    utrRafRef.current = window.requestAnimationFrame(() => {
      utrRafRef.current = 0
      const container = utrInputRef.current
      if (!container) return
      const input = container.querySelector<HTMLInputElement>("input")
      const rect = container.getBoundingClientRect()
      // Position the UTR field comfortably in the upper third of the viewport, clear of both the sticky header and mobile bottom bar / keyboard.
      const headerOffset = window.innerWidth < 900 ? 72 : 96
      const desiredTop = Math.max(0, window.scrollY + rect.top - headerOffset)
      window.scrollTo({ top: desiredTop, behavior: "smooth" })
      utrTimerRef.current = window.setTimeout(() => {
        utrTimerRef.current = 0
        input?.focus({ preventScroll: true })
      }, 220)
    })
  }, [])

  const navigateToOrderPlaced = useCallback(
    (orderCode: string) => {
      clearCheckoutDraft()
      if (typeof document !== "undefined") {
        ;(document.activeElement as HTMLElement | null)?.blur?.()
      }
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" })
      }
      router.replace(`/order-placed?code=${encodeURIComponent(orderCode)}`)
    },
    [router]
  )

  if (ownerId !== trackedOwnerId) {
    setTrackedOwnerId(ownerId)
    setStep(1)
    setMobileSummaryOpen(false)
    setPromoOpen(false)
    setClientAddresses(ownerId ? null : [])
    setClientProfile(null)
    setClearedOnSignOut(!ownerId)
    setSelected("new")
    setSaveAddress(true)
    setOneTimeAddress(null)
    setAddressModal(null)
    setHasOrderNote(false)
    setShowMobileQr(false)
    setPaymentRef("")
    setPaymentRefError(null)
    setPromoInput("")
    setAppliedPromo(null)
    setPromoError(null)
  }

  useEffect(() => {
    if (step === 3) {
      router.prefetch("/order-placed")
    }
  }, [step, router])

  useLayoutEffect(() => {
    return () => {
      resetHistoryDepth()
      setStep(1)
      setMobileSummaryOpen(false)
      setPromoOpen(false)
      setAddressModal(null)
      setShowMobileQr(false)
      setPaymentRef("")
      setPaymentRefError(null)
      setPromoError(null)
      setRedirecting(false)
      setFrozenAvailable(null)
    }
  }, [resetHistoryDepth])

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
  const watchedFormValues = useWatch({ control: form.control })
  const area = usePincodeLookup({
    pincode: watchedFormValues.pincode ?? "",
    getCity: () => form.getValues("city"),
    setCity: (city) => form.setValue("city", city, { shouldValidate: true, shouldDirty: true }),
    getState: () => form.getValues("state"),
    setState: (state) => form.setValue("state", state as IndianState, { shouldValidate: true, shouldDirty: true }),
  })
  const { prime: primeArea } = area
  const lastAppliedSavedKey = useRef<string>(
    initialDefault
      ? `${initialDefault.id}:${initialDefault.fullName}:${initialDefault.phone}:${initialDefault.address}:${initialDefault.city}:${initialDefault.pincode}`
      : ""
  )
  const appliedInitialProfile = useRef<boolean>(Boolean(!initialDefault && initialProfile))

  const fillFrom = (a: Address) => {
    setSelected(a.id)
    const split = splitCityState(a.city)
    lastAppliedSavedKey.current = `${a.id}:${a.fullName}:${a.phone}:${a.address}:${a.city}:${a.pincode}`
    primeArea(a.pincode, split.city, split.state)
    form.reset({
      name: a.fullName,
      phone: a.phone,
      address: a.address,
      ...split,
      pincode: a.pincode,
      note: form.getValues("note"),
    })
  }

  const openNewAddressModal = (fromList = false, editExistingOneTime = false) => {
    setOpenedNewFromList(fromList)
    setEditingOneTime(editExistingOneTime)
    setAddrModalKey((k) => k + 1)
    setAddressModal("new")
  }

  const applyOneTimeAddress = (addr: OneTimeAddress) => {
    setOneTimeAddress(addr)
    setSelected("new")
    setSaveAddress(false)
    lastAppliedSavedKey.current = "new"
    primeArea(addr.pincode, addr.city, addr.state)
    form.reset({
      name: addr.fullName,
      phone: addr.phone,
      address: addr.address,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      note: form.getValues("note"),
    })
  }

  const handleModalAddressSubmit = (
    values: CheckoutInput,
    opts: { saveToAccount: boolean; label: (typeof ADDRESS_LABELS)[number] }
  ) => {
    const cleanPhone = normalizeIndianPhone(values.phone) ?? values.phone.trim()
    if (!opts.saveToAccount) {
      applyOneTimeAddress({
        fullName: values.name.trim(),
        phone: cleanPhone,
        address: values.address.trim(),
        city: values.city.trim(),
        state: values.state,
        pincode: values.pincode.trim(),
      })
      setAddressModal(null)
      toast.success("Delivery address updated for this order")
      return
    }
    startSaveAddr(async () => {
      try {
        const res = await saveAccountAddress(null, {
          label: opts.label,
          fullName: values.name.trim(),
          phone: cleanPhone,
          address: values.address.trim(),
          city: values.city.trim(),
          state: values.state,
          pincode: values.pincode.trim(),
          isDefault: false,
        })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const updatedList = await listMyAddresses()
        setClientAddresses(updatedList)
        const expectedCity = joinCityState(values.city.trim(), values.state).toLowerCase()
        const matched =
          updatedList
            .slice()
            .reverse()
            .find(
              (a) =>
                a.pincode.trim() === values.pincode.trim() &&
                a.address.trim().toLowerCase() === values.address.trim().toLowerCase() &&
                a.city.trim().toLowerCase() === expectedCity
            ) ?? updatedList[updatedList.length - 1]
        if (matched) {
          setOneTimeAddress(null)
          fillFrom(matched)
        }
        setAddressModal(null)
        toast.success("Address saved & selected for delivery")
        router.refresh()
      } catch {
        toast.error("Couldn't save address. Please try again.")
      }
    })
  }

  const activeSavedAddress = signedIn && selected !== "new" ? addresses.find((a) => a.id === selected) : undefined
  const activeSavedKey = activeSavedAddress
    ? `${activeSavedAddress.id}:${activeSavedAddress.fullName}:${activeSavedAddress.phone}:${activeSavedAddress.address}:${activeSavedAddress.city}:${activeSavedAddress.pincode}`
    : ""

  // Pre-fill form when saved addresses load or the selected saved address updates
  useEffect(() => {
    if (activeSavedAddress) {
      if (lastAppliedSavedKey.current === activeSavedKey || form.formState.isDirty) return
      lastAppliedSavedKey.current = activeSavedKey
      const split = splitCityState(activeSavedAddress.city)
      primeArea(activeSavedAddress.pincode, split.city, split.state)
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
    if (selected === "new" && lastAppliedSavedKey.current === "new") {
      return
    }
    if (form.formState.isDirty) return
    const first = canUseInitial ? initialAddresses[0] : undefined
    if (first && !form.getValues("address")) {
      const firstKey = `${first.id}:${first.fullName}:${first.phone}:${first.address}:${first.city}:${first.pincode}`
      if (lastAppliedSavedKey.current === firstKey) return
      lastAppliedSavedKey.current = firstKey
      queueMicrotask(() => setSelected(first.id))
      const split = splitCityState(first.city)
      primeArea(first.pincode, split.city, split.state)
      form.reset({
        name: first.fullName,
        phone: first.phone,
        address: first.address,
        ...split,
        pincode: first.pincode,
        note: form.getValues("note"),
      })
    } else if (
      !first &&
      canUseInitial &&
      initialProfile &&
      !appliedInitialProfile.current &&
      ((initialProfile.fullName && !form.getValues("name")) || (initialProfile.phone && !form.getValues("phone")))
    ) {
      appliedInitialProfile.current = true
      const current = form.getValues()
      form.reset({
        ...current,
        name: current.name || initialProfile.fullName,
        phone: current.phone || initialProfile.phone,
      })
    }
  }, [activeSavedAddress, activeSavedKey, selected, canUseInitial, initialAddresses, initialProfile, form, primeArea])

  // Clear cached account addresses/autofill if the user signs out while CheckoutForm stays mounted
  useEffect(() => {
    if (signedIn) {
      wasSignedIn.current = true
      return
    }
    if (!authReady || !wasSignedIn.current) return
    wasSignedIn.current = false
    clearCheckoutDraft()
    fetchedForUser.current = null
    lastAppliedSavedKey.current = ""
    appliedInitialProfile.current = false
    primeArea("", "", NO_STATE)
    form.reset({ name: "", phone: "", address: "", city: "", state: NO_STATE, pincode: "", note: "" })
    queueMicrotask(() => {
      resetHistoryDepth()
      setStep(1)
      setMobileSummaryOpen(false)
      setPromoOpen(false)
      setClearedOnSignOut(true)
      setClientAddresses(null)
      setClientProfile(null)
      setSelected("new")
      setPaymentRef("")
      setPaymentRefError(null)
      setPromoInput("")
      setAppliedPromo(null)
      setPromoError(null)
    })
  }, [authReady, signedIn, form, primeArea, resetHistoryDepth])

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
      lastAppliedSavedKey.current = ""
      appliedInitialProfile.current = false
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
        if (!switchedAccount && (form.formState.isDirty || lastAppliedSavedKey.current === "new")) return
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

  // Restore active checkout step & draft after a page refresh (web & mobile)
  useEffect(() => {
    if (preview || !authReady || restoredDraftRef.current) return
    restoredDraftRef.current = true
    draftReadyToPersistRef.current = true
    const draft = readCheckoutDraft()
    const histRaw =
      typeof window !== "undefined"
        ? (window.history.state as Record<string, unknown> | null)?.checkoutStep
        : null
    const histStep: CheckoutStep | null = histRaw === 1 || histRaw === 2 || histRaw === 3 ? histRaw : null

    if (draft && draft.ownerId !== ownerId) {
      clearCheckoutDraft()
    } else if (draft && draft.ownerId === ownerId) {
      const matchedSaved = draft.selectedId !== "new" ? addresses.find((a) => a.id === draft.selectedId) : undefined
      if (matchedSaved) {
        const split = splitCityState(matchedSaved.city)
        lastAppliedSavedKey.current = `${matchedSaved.id}:${matchedSaved.fullName}:${matchedSaved.phone}:${matchedSaved.address}:${matchedSaved.city}:${matchedSaved.pincode}`
        primeArea(matchedSaved.pincode, split.city, split.state)
        form.reset({
          name: matchedSaved.fullName,
          phone: matchedSaved.phone,
          address: matchedSaved.address,
          ...split,
          pincode: matchedSaved.pincode,
          note: draft.formValues.note ?? "",
        })
      } else if (draft.selectedId === "new" && (draft.formValues.address || draft.formValues.name || draft.formValues.phone)) {
        lastAppliedSavedKey.current = "new"
        if (draft.formValues.pincode) {
          primeArea(draft.formValues.pincode, draft.formValues.city, draft.formValues.state)
        }
        form.reset(draft.formValues)
      }
      const desiredStep = histStep ?? draft.step
      const hasValidAddress = Boolean(matchedSaved) || checkoutSchema.safeParse(draft.formValues).success
      queueMicrotask(() => {
        if (draft.oneTimeAddress) setOneTimeAddress(draft.oneTimeAddress)
        if (draft.appliedPromo) setAppliedPromo(draft.appliedPromo)
        if (matchedSaved) setSelected(matchedSaved.id)
        else if (draft.selectedId === "new" && (draft.formValues.address || draft.formValues.name || draft.formValues.phone)) {
          setSelected("new")
        }
        if (draft.formValues.note) setHasOrderNote(true)
        if (desiredStep > 1 && hasValidAddress) {
          setStep(desiredStep)
          syncHistoryDepth(desiredStep, Boolean(histStep))
        } else if (histStep && histStep > 1) {
          syncHistoryDepth(1, true)
        }
      })
      return
    }

    if (histStep && histStep > 1) {
      if (addresses.length > 0) {
        queueMicrotask(() => {
          setStep(histStep)
          syncHistoryDepth(histStep, true)
        })
      } else {
        syncHistoryDepth(1, true)
      }
    }
  }, [preview, authReady, ownerId, addresses, form, primeArea, syncHistoryDepth])

  // Persist checkout step & draft in sessionStorage so refreshing on Summary or Payment keeps the user in place
  useEffect(() => {
    if (preview || redirecting || !draftReadyToPersistRef.current) return
    if (ready && available.length === 0) {
      clearCheckoutDraft()
      return
    }
    writeCheckoutDraft({
      ownerId,
      step,
      selectedId: selected,
      oneTimeAddress,
      appliedPromo,
      formValues: form.getValues(),
      savedAt: Date.now(),
    })
  }, [preview, redirecting, ready, available.length, ownerId, step, selected, oneTimeAddress, appliedPromo, watchedFormValues, form])

  const getCustomerPayload = (): CheckoutInput => {
    const values = form.getValues()
    return activeSavedAddress
      ? {
          name: activeSavedAddress.fullName,
          phone: activeSavedAddress.phone,
          address: activeSavedAddress.address,
          ...splitCityState(activeSavedAddress.city),
          pincode: activeSavedAddress.pincode,
          note: values.note,
        }
      : values
  }

  const handleContinueFromStep1 = async () => {
    if (!activeSavedAddress) {
      const ok = await form.trigger(["name", "phone", "address", "pincode", "city", "state"], { shouldFocus: true })
      if (!ok) return
      if (area.error) {
        form.setError("pincode", { message: area.error })
        form.setFocus("pincode")
        return
      }
    }
    moveToStep(2)
  }

  const handleContinueFromStep2 = async () => {
    const noteOk = await form.trigger(["note"], { shouldFocus: true })
    if (!noteOk) return
    setPaymentRefError(null)
    moveToStep(3)
  }

  const runGatewayCheckout = (customerPayload: CheckoutInput) => {
    startTransition(async () => {
      try {
        const activeDiscount = computePromoDiscount(appliedPromo, charges.subtotal)
        const res = await createGatewayCheckoutSession({
          customer: customerPayload,
          items: available.map((l) => ({ productId: l.productId, ...(l.variantId ? { variantId: l.variantId } : {}), quantity: l.quantity })),
          promoCode: appliedPromo && activeDiscount > 0 ? appliedPromo.code : undefined,
          expectedTotal: shownCharges.total,
          saveAddress: signedIn && selected === "new" && saveAddress,
        })
        if (!res.ok) {
          if (res.error.toLowerCase().includes("promo code")) {
            setAppliedPromo(null)
            setPromoError(res.error)
            setPromoOpen(true)
            moveToStep(2)
            toast.error(res.error)
            return
          }
          if (res.error.toLowerCase().includes("updated")) {
            toast.error(res.error)
            router.refresh()
            return
          }
          let hadAddressError = false
          for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
            const msg = messages?.[0]
            if (msg && field in customerPayload) {
              form.setError(field as keyof CheckoutInput, { message: msg })
              if (field !== "note") hadAddressError = true
            }
          }
          if (hadAddressError) moveToStep(1)
          toast.error(res.error)
          return
        }

        const outcome = await openGatewayCheckout(res.data.session)
        if (outcome.status === "redirecting") {
          setRedirecting(true)
          return
        }
        if (outcome.status === "dismissed" || outcome.status === "failed" || outcome.status === "unsupported") {
          if (outcome.status !== "unsupported") {
            const latest = await trackOrder({ code: res.data.orderCode, phoneLast4: res.data.phoneLast4 })
            if (latest.ok && latest.data.paymentStatus === "paid") {
              showBusySuccess("Payment confirmed!")
              setOneTimeAddress(null)
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
              for (const l of available) removeCartItem(cartLineKey(l))
              navigateToOrderPlaced(res.data.orderCode)
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
        setOneTimeAddress(null)
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
        for (const l of available) removeCartItem(cartLineKey(l))
        if (!verified.ok) {
          toast.info("Confirming your payment…")
        }
        navigateToOrderPlaced(res.data.orderCode)
      } catch {
        toast.error("Couldn't start online payment. Please check your connection and try again.")
      }
    })
  }

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
        setPromoOpen(false)
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
    const customerPayload = getCustomerPayload()
    if (shop.paymentMode === "gateway") {
      runGatewayCheckout(customerPayload)
      return
    }
    const parsedRef = paymentReferenceSchema.safeParse(paymentRef)
    if (!parsedRef.success) {
      setPaymentRefError(parsedRef.error.issues[0]?.message ?? "Please enter your 12-digit UTR / UPI reference number.")
      focusUtrInput()
      return
    }
    setPaymentRefError(null)
    startTransition(async () => {
      try {
        const activeDiscount = computePromoDiscount(appliedPromo, charges.subtotal)
        const res = await placeOrder({
          customer: customerPayload,
          items: available.map((l) => ({ productId: l.productId, ...(l.variantId ? { variantId: l.variantId } : {}), quantity: l.quantity })),
          paymentReference: parsedRef.data,
          promoCode: appliedPromo && activeDiscount > 0 ? appliedPromo.code : undefined,
          expectedTotal: shownCharges.total,
          saveAddress: signedIn && selected === "new" && saveAddress,
        })
        if (!res.ok) {
          const refFieldMsg = res.fieldErrors?.paymentReference?.[0]
          if (refFieldMsg) {
            setPaymentRefError(refFieldMsg)
            focusUtrInput()
            return
          }
          if (res.error.toLowerCase().includes("promo code")) {
            setAppliedPromo(null)
            setPromoError(res.error)
            setPromoOpen(true)
            moveToStep(2)
            toast.error(res.error)
            return
          }
          if (res.error.toLowerCase().includes("updated")) {
            toast.error(res.error)
            router.refresh()
            return
          }
          let hadAddressError = false
          for (const [field, messages] of Object.entries(res.fieldErrors ?? {})) {
            const msg = messages?.[0]
            if (msg && field in customerPayload) {
              form.setError(field as keyof CheckoutInput, { message: msg })
              if (field !== "note") hadAddressError = true
            }
          }
          if (hadAddressError) moveToStep(1)
          toast.error(res.error)
          return
        }
        showBusySuccess("Order placed!")
        setOneTimeAddress(null)
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
        for (const l of available) removeCartItem(cartLineKey(l))
        navigateToOrderPlaced(res.data.orderCode)
      } catch {
        toast.error("Couldn't place your order. Please check your connection and try again.")
      }
    })
  }

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (pending || placeholder) return
    if (step === 1) {
      void handleContinueFromStep1()
    } else if (step === 2) {
      void handleContinueFromStep2()
    } else {
      confirmPaymentAndPlaceOrder()
    }
  }

  // The real cart is in localStorage (unknown until hydration): show a placeholder order in the real layout meanwhile.
  // While redirecting to /order-placed, keep the snapshot of items/charges frozen so the page never flashes ₹0.
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
  const hasCompactSelectedCard = Boolean(signedIn && addresses.length > 0 && (activeSavedAddress || oneTimeAddress) && !hasAddressFieldError)
  const showAddressInputs = !hasCompactSelectedCard

  const deliveryRecap = activeSavedAddress
    ? {
        label: activeSavedAddress.label,
        name: activeSavedAddress.fullName,
        phone: activeSavedAddress.phone,
        line: `${activeSavedAddress.address}, ${activeSavedAddress.city} - ${activeSavedAddress.pincode}`,
      }
    : oneTimeAddress
      ? {
          label: "One-time",
          name: oneTimeAddress.fullName,
          phone: oneTimeAddress.phone,
          line: `${oneTimeAddress.address}, ${joinCityState(oneTimeAddress.city, oneTimeAddress.state)} - ${oneTimeAddress.pincode}`,
        }
      : {
          label: "Delivery",
          name: watchedFormValues.name || "",
          phone: watchedFormValues.phone || "",
          line: [
            watchedFormValues.address,
            watchedFormValues.city && watchedFormValues.state
              ? joinCityState(watchedFormValues.city, watchedFormValues.state)
              : watchedFormValues.city,
          ]
            .filter(Boolean)
            .join(", ")
            .concat(watchedFormValues.pincode ? ` - ${watchedFormValues.pincode}` : ""),
        }

  const { upiId, upiPayeeName, orderCodePrefix } = shop
  const upiUrl = upiId
    ? buildUpiUrl({
        upiId,
        payeeName: upiPayeeName,
        amount: shownCharges.total,
        orderCode: orderCodePrefix || "Order",
      })
    : null

  const currentStepMeta = CHECKOUT_STEPS[step - 1]
  const mobileCtaLabel =
    step === 1
      ? hasCompactSelectedCard
        ? "Deliver here"
        : "Continue"
      : step === 2
        ? "Proceed to pay"
        : shop.paymentMode === "gateway"
          ? `Pay ${formatPrice(shownCharges.total)}`
          : "Place order"

  const trustAndPolicies = (
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
  )

  const promoBlock = (
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
      ) : !promoOpen && !promoError && !promoBelowMin ? (
        <button
          type="button"
          onClick={() => setPromoOpen(true)}
          className={styles.promoToggleBtn}
        >
          <span className={styles.promoToggleLeft}>
            <TagIcon className={styles.promoTagSvg} aria-hidden />
            <span>Have a promo code?</span>
          </span>
          <span className={styles.promoToggleAction}>Apply</span>
        </button>
      ) : (
        <div className={styles.promoInputStack}>
          <div className={styles.promoInputRow}>
            <TextField
              label="Promo code"
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
              <button type="button" onClick={handleRemovePromo} className={styles.removeInlineBtn}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const view = (
    <>
      <div ref={stepperTopRef} className={styles.checkoutFlowWrap}>
        {/* NATIVE MOBILE FULL-VIEW APP TOP BAR + MODERN STEPS COUNTER (< 900px) */}
        <div className={styles.mobileAppHeader}>
          <div className={styles.mobileAppBarRow}>
            {step === 1 ? (
              <Link href="/cart" aria-label="Back to cart" className={styles.mobileAppBackBtn}>
                <ArrowLeftIcon className={styles.icon18} />
              </Link>
            ) : (
              <button
                type="button"
                disabled={pending}
                aria-label="Previous step"
                onClick={() => moveToStep((step - 1) as CheckoutStep)}
                className={styles.mobileAppBackBtn}
              >
                <ArrowLeftIcon className={styles.icon18} />
              </button>
            )}
            <div className={styles.mobileAppTitleCol}>
              <span className={styles.mobileAppStepTitle}>{currentStepMeta.mobileTitle}</span>
            </div>
            {step === 3 ? (
              <span className={styles.mobileLockedPill}>
                <LockIcon className={styles.lockTinySvg} aria-hidden /> Final
              </span>
            ) : (
              <span className={styles.mobileSafePill}>
                <ShieldCheckIcon className={styles.lockTinySvg} aria-hidden /> Safe
              </span>
            )}
          </div>

          <nav aria-label="Checkout progress" className={styles.mobileStepperRail}>
            <ol className={styles.mobileStepperList}>
              {CHECKOUT_STEPS.map((s, idx) => {
                const isCurrent = step === s.step
                const isDone = step > s.step
                const StepIcon = s.step === 1 ? MapPinIcon : s.step === 2 ? ShoppingBagIcon : CreditCardIcon
                return (
                  <li key={s.step} className={styles.mobileStepNode}>
                    <button
                      type="button"
                      disabled={!isDone || pending}
                      aria-current={isCurrent ? "step" : undefined}
                      onClick={() => {
                        if (isDone) moveToStep(s.step)
                      }}
                      className={cn(
                        styles.mobileStepBtn,
                        isCurrent && styles.mobileStepBtnCurrent,
                        isDone && styles.mobileStepBtnDone
                      )}
                    >
                      <span className={styles.mobileStepCircle} aria-hidden>
                        {isDone ? <CheckIcon className={styles.stepCheckSvg} /> : <StepIcon className={styles.stepIconTiny} />}
                      </span>
                      <span className={styles.mobileStepLabel}>{s.shortLabel}</span>
                    </button>
                    {idx < CHECKOUT_STEPS.length - 1 && (
                      <span
                        aria-hidden
                        className={cn(styles.mobileStepConnector, step > s.step && styles.mobileStepConnectorDone)}
                      />
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        </div>

        {/* MOBILE COLLAPSIBLE ORDER SUMMARY ACCORDION (Shopify/Apple style on Step 1 & Step 3) */}
        {step !== 2 && (
          <div className={styles.mobileAccordionWrap}>
            <button
              type="button"
              aria-expanded={mobileSummaryOpen}
              onClick={() => setMobileSummaryOpen((v) => !v)}
              className={styles.mobileAccordionTrigger}
            >
              <span className={styles.mobileAccordionLeft}>
                <ShoppingBagIcon className={styles.accordionBagSvg} aria-hidden />
                <span>
                  {step === 3 ? "Final order summary" : "Order summary"} ({shownCount} {shownCount === 1 ? "item" : "items"})
                </span>
                <ChevronDownIcon className={cn(styles.accordionChevron, mobileSummaryOpen && styles.accordionChevronOpen)} aria-hidden />
              </span>
              <span className={styles.mobileAccordionPrice}>{formatPrice(shownCharges.total)}</span>
            </button>
            {mobileSummaryOpen && (
              <div className={styles.mobileAccordionBody}>
                <ul className={styles.miniItemsList}>
                  {shown.map((l) => (
                    <li key={cartLineKey(l)} className={styles.miniItemRow}>
                      <div className={styles.miniThumbWrap}>
                        <ProductImage src={l.image} alt={l.name} sizes="40px" />
                        <span className={styles.miniQtyBubble}>{l.quantity}</span>
                      </div>
                      <span className={styles.miniItemTextCol}>
                        <span className={styles.miniItemName}>{l.name}</span>
                        {l.variantLabel && <span className={styles.miniItemVariant}>{l.variantLabel}</span>}
                      </span>
                      <span className={styles.miniItemPrice}>{formatPrice(l.price * l.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {appliedPromo && !promoBelowMin && (
                  <p className={styles.lockedPromoBadge}>
                    <TicketPercentIcon className={styles.ticketSvg} aria-hidden />
                    <span>
                      <strong className={styles.monoCode}>{appliedPromo.code}</strong> applied · Saving {formatPrice(shownCharges.discountAmount ?? 0)}
                    </span>
                  </p>
                )}
                <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel={step === 3 ? "Final amount" : "Total"} className={styles.breakdownTopBorder} />
                {step === 3 && (
                  <button type="button" onClick={() => moveToStep(2)} className={styles.editLockedLinkBtn}>
                    Edit order or promo code
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* DESKTOP WEB MODERN 3-STEP PROGRESS BAR (>= 900px) */}
        <nav aria-label="Checkout progress" className={styles.desktopStepperNav}>
          <ol className={styles.desktopStepperList}>
            {CHECKOUT_STEPS.map((s, idx) => {
              const isCurrent = step === s.step
              const isDone = step > s.step
              const StepIcon = s.step === 1 ? MapPinIcon : s.step === 2 ? ShoppingBagIcon : CreditCardIcon
              return (
                <li key={s.step} className={styles.desktopStepItem}>
                  <button
                    type="button"
                    disabled={!isDone || pending}
                    aria-current={isCurrent ? "step" : undefined}
                    onClick={() => {
                      if (isDone) moveToStep(s.step)
                    }}
                    className={cn(
                      styles.desktopStepBtn,
                      isCurrent && styles.desktopStepBtnCurrent,
                      isDone && styles.desktopStepBtnDone
                    )}
                  >
                    <span className={styles.desktopStepNum} aria-hidden>
                      {isDone ? <CheckIcon className={styles.stepCheckSvg} /> : <StepIcon className={styles.stepIconSm} />}
                    </span>
                    <span className={styles.desktopStepTextCol}>
                      <span className={styles.desktopStepKicker}>
                        {isDone ? "Completed" : `Step ${s.step}`}
                      </span>
                      <span className={styles.desktopStepLabel}>{s.label}</span>
                    </span>
                  </button>
                  {idx < CHECKOUT_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(styles.desktopStepLine, step > s.step && styles.desktopStepLineDone)}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </nav>

        <form onSubmit={handleFormSubmit} noValidate className={styles.checkoutFormGrid}>
          <div className={styles.mainColumn}>
            {/* STEP 1: DELIVERY ADDRESS */}
            {step === 1 && (
              <section aria-labelledby="checkout-step-1-heading" className={styles.stepCard}>
                <div className={styles.stepHeaderRow}>
                  <div>
                    <h2 id="checkout-step-1-heading" ref={stepHeadingRef} tabIndex={-1} className={styles.stepTitle}>
                      <span className={styles.stepBadge}>1</span>
                      Delivery details
                    </h2>
                    <p className={styles.stepSubtext}>
                      {signedIn ? (
                        addresses.length > 0 ? "Confirm where we should deliver this order." : "Enter where we should deliver."
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
                    <Link href="/account/profile?tab=addresses" className={styles.smallActionLink}>
                      Manage addresses
                    </Link>
                  )}
                </div>

                {hasCompactSelectedCard && (
                  <div className={styles.selectedAddrWrap}>
                    <div className={styles.selectedAddrCard}>
                      {activeSavedAddress ? (
                        <>
                          <span className={styles.addrTitleRow}>
                            <MapPinIcon className={styles.pinSvg} aria-hidden />
                            <span>{activeSavedAddress.label}</span>
                            {activeSavedAddress.isDefault && <span className={styles.defaultBadge}>Default</span>}
                            <span className={styles.deliveringBadge}>
                              <CheckCircle2Icon className={styles.activeCheckSvg} aria-hidden /> Delivering here
                            </span>
                          </span>
                          <span className={styles.addrPersonLine}>
                            {activeSavedAddress.fullName} <span className={styles.addrPhoneMuted}>· +91 {activeSavedAddress.phone}</span>
                          </span>
                          <span className={styles.addrStreetLine}>
                            {activeSavedAddress.address}, {activeSavedAddress.city} - {activeSavedAddress.pincode}
                          </span>
                        </>
                      ) : oneTimeAddress ? (
                        <>
                          <span className={styles.addrTitleRow}>
                            <MapPinIcon className={styles.pinSvg} aria-hidden />
                            <span className={styles.oneTimeBadge}>One-time address</span>
                            <span className={styles.deliveringBadge}>
                              <CheckCircle2Icon className={styles.activeCheckSvg} aria-hidden /> Delivering here
                            </span>
                          </span>
                          <span className={styles.addrPersonLine}>
                            {oneTimeAddress.fullName} <span className={styles.addrPhoneMuted}>· +91 {oneTimeAddress.phone}</span>
                          </span>
                          <span className={styles.addrStreetLine}>
                            {oneTimeAddress.address}, {joinCityState(oneTimeAddress.city, oneTimeAddress.state)} - {oneTimeAddress.pincode}
                          </span>
                        </>
                      ) : null}
                    </div>

                    <div className={styles.addrActionsBar}>
                      {(addresses.length > 1 || Boolean(oneTimeAddress)) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setAddressModal("list")}
                        >
                          Change address{addresses.length > 1 ? ` (${addresses.length})` : ""}
                        </Button>
                      )}
                      {!activeSavedAddress && oneTimeAddress && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openNewAddressModal(false, true)}
                        >
                          <PencilIcon aria-hidden="true" /> Edit
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="soft"
                        size="sm"
                        onClick={() => openNewAddressModal(false)}
                      >
                        <PlusIcon aria-hidden="true" /> Add new address
                      </Button>
                    </div>
                  </div>
                )}

                {showAddressInputs && (
                  <div className={styles.addressFieldsGrid}>
                    <TextField label="Full name" kind="personName" autoComplete="name" error={errors.name?.message} {...form.register("name")} />
                    <TextField
                      label="WhatsApp / mobile number"
                      kind="phone"
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
                      label="Full address"
                      maxLength={LIMITS.address.max}
                      autoComplete="street-address"
                      rows={3}
                      placeholder="House no., street, landmark"
                      containerClassName={styles.spanTwoCols}
                      error={errors.address?.message}
                      {...form.register("address")}
                    />
                    <TextField
                      label="Pincode"
                      kind="pincode"
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

                {signedIn && showAddressInputs && selected === "new" && (
                  <SwitchField
                    label="Save this address to my account"
                    description="Use it next time in one tap"
                    checked={saveAddress}
                    onCheckedChange={setSaveAddress}
                  />
                )}

                <div className={styles.stepDesktopActions}>
                  <Button type="submit" size="lg" disabled={pending || placeholder} className={styles.stepContinueBtn}>
                    {hasCompactSelectedCard ? "Deliver here & review order" : "Continue to Order Summary"}{" "}
                    <ArrowRightIcon className={styles.icon16} />
                  </Button>
                </div>
              </section>
            )}

            {/* STEP 2: ORDER SUMMARY & PROMO CODE */}
            {step === 2 && (
              <>
                <div className={styles.recapStripCard}>
                  <div className={styles.recapStripBody}>
                    <span className={styles.recapStripTitleRow}>
                      <MapPinIcon className={styles.recapPinSvg} aria-hidden />
                      <span className={styles.recapHeading}>Delivering to {deliveryRecap.name}</span>
                      {deliveryRecap.label && <span className={styles.recapTag}>{deliveryRecap.label}</span>}
                    </span>
                    <p className={styles.recapSubLine}>
                      {deliveryRecap.line}
                      {deliveryRecap.phone ? ` · +91 ${deliveryRecap.phone}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => moveToStep(1)} className={styles.recapChangeBtn}>
                    Change
                  </button>
                </div>

                <section aria-labelledby="checkout-step-2-heading" className={styles.orderStepCard}>
                  <div className={styles.stepHeaderCenterRow}>
                    <h2 id="checkout-step-2-heading" ref={stepHeadingRef} tabIndex={-1} className={styles.stepTitle}>
                      <span className={styles.stepBadge}>2</span>
                      Order summary
                      <span className={styles.itemCountPill}>
                        {shownCount} item{shownCount === 1 ? "" : "s"}
                      </span>
                    </h2>
                    <Link href="/cart" className={styles.smallActionLink}>
                      Edit cart
                    </Link>
                  </div>

                  <ul className={styles.orderItemsUl}>
                    {shown.map((l) => (
                      <li key={cartLineKey(l)}>
                        <Link href={`/products/${l.slug}`} className={styles.orderLineLink}>
                          <div className={styles.lineThumbWrap}>
                            <ProductImage src={l.image} alt={l.name} sizes="60px" className={styles.lineThumbImg} />
                            <span className={styles.qtyBubble}>{l.quantity}</span>
                          </div>
                          <span className={styles.lineTextCol}>
                            <span className={styles.lineNameText}>{l.name}</span>
                            {l.variantLabel && <span className={styles.lineVariantPill}>{l.variantLabel}</span>}
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

                  {/* Promo code lives cleanly inside Step 2 (Order Summary) before price is locked for Payment */}
                  <div className={styles.stepPromoWrap}>
                    {promoBlock}
                  </div>

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
                        label="Order note (optional)"
                        maxLength={LIMITS.note.max}
                        rows={2}
                        placeholder="Write your gift message, custom name, or preferred colour…"
                        error={errors.note?.message}
                        {...form.register("note")}
                      />
                    )}
                  </div>

                  <div className={styles.stepDesktopActions}>
                    <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => moveToStep(1)} className={styles.stepBackBtn}>
                      <ArrowLeftIcon className={styles.icon16} /> Back
                    </Button>
                    <Button type="submit" size="lg" disabled={pending || placeholder} className={styles.stepContinueBtn}>
                      Confirm &amp; Pay {formatPrice(shownCharges.total)} <ArrowRightIcon className={styles.icon16} />
                    </Button>
                  </div>
                </section>
              </>
            )}

            {/* STEP 3: DEDICATED PAYMENT SCREEN (PRICE LOCKED, NO PROMO DISTRACTION) */}
            {step === 3 && (
              <section aria-labelledby="checkout-step-3-heading" className={styles.stepCard}>
                <div className={styles.paymentHeroHeader}>
                  <div>
                    <h2 id="checkout-step-3-heading" ref={stepHeadingRef} tabIndex={-1} className={styles.stepTitle}>
                      <span className={styles.stepBadge}>3</span>
                      {shop.paymentMode === "gateway" ? "Complete payment" : "Pay via UPI"}
                    </h2>
                    <p className={styles.stepSubtext}>
                      {shop.paymentMode === "gateway"
                        ? "Your order total is finalized. Choose your payment method in the secure gateway."
                        : "Your order total is finalized. Pay using any UPI app and enter your 12-digit UTR below."}
                    </p>
                  </div>
                  <div className={styles.lockedAmountBox}>
                    <span className={styles.lockedAmountCaption}>
                      <LockIcon className={styles.lockTinySvg} aria-hidden /> Final payable
                    </span>
                    <span className={styles.lockedAmountFigure}>{formatPrice(shownCharges.total)}</span>
                  </div>
                </div>

                {promoBelowMin && appliedPromo && (
                  <div role="status" className={styles.promoWarningRow}>
                    <span>
                      Promo <strong>{appliedPromo.code}</strong> needs a minimum order of{" "}
                      {formatPrice(appliedPromo.minOrderAmount)} and wasn&apos;t applied to this total.
                    </span>
                    <button type="button" onClick={() => moveToStep(2)} className={styles.recapChangeBtn}>
                      Review
                    </button>
                  </div>
                )}

                {shop.paymentMode === "gateway" ? (
                  <div className={styles.gatewayCard}>
                    <div className={styles.gatewayIconRow}>
                      <span className={styles.gatewayIconBadge}>
                        <CreditCardIcon className={styles.gatewayIcon} aria-hidden />
                      </span>
                      <div className={styles.gatewayCopyCol}>
                        <p className={styles.gatewayTitle}>Instant online payment</p>
                        <p className={styles.gatewaySub}>
                          Google Pay, PhonePe, Paytm, BHIM UPI, Credit/Debit Cards &amp; NetBanking.
                        </p>
                      </div>
                    </div>
                    <p className={styles.gatewaySafeLine}>
                      <ShieldCheckIcon className={styles.checkSvg} aria-hidden />
                      <span>100% encrypted · Your cart stays saved if you cancel payment.</span>
                    </p>
                  </div>
                ) : (
                  <div className={styles.upiInlineFlow}>
                    {upiUrl && upiId ? (
                      <div className={styles.upiStepBlock}>
                        <p className={styles.dialogStepHeading}>
                          <span className={styles.solidStepNum}>1</span>
                          Pay {formatPrice(shownCharges.total)} with any UPI app
                        </p>
                        <a href={upiUrl} className={cn(buttonVariants({ variant: "primary", size: "xl", fullWidth: true }), styles.upiDeepLinkBtn)}>
                          <SmartphoneIcon className={styles.phoneSvg} aria-hidden="true" /> Pay {formatPrice(shownCharges.total)} with UPI app
                        </a>
                        <Button
                          type="button"
                          variant="outline"
                          size="lg"
                          fullWidth
                          onClick={() => setShowMobileQr((v) => !v)}
                          aria-expanded={showMobileQr}
                          className={styles.qrToggleBtn}
                        >
                          <QrCodeIcon className={styles.qrSvg} aria-hidden="true" />
                          {showMobileQr ? "Hide QR code" : "Show QR code (scan from another device)"}
                        </Button>
                        <div className={cn(styles.qrCardRow, showMobileQr && styles.qrCardRowVisible)}>
                          <div className={styles.qrWhiteFrame}>
                            <QRCodeSVG value={upiUrl} size={112} marginSize={0} title={`UPI QR code to pay ${formatPrice(shownCharges.total)}`} />
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

                    <div ref={utrInputRef} className={styles.utrStepSection}>
                      <p className={styles.dialogStepHeading}>
                        <span className={styles.solidStepNum}>2</span>
                        Enter your 12-digit UTR / UPI reference number
                      </p>
                      <TextField
                        label="UTR / UPI reference number"
                        kind="paymentRef"
                        required
                        enterKeyHint="done"
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
                  </div>
                )}

                <div className={styles.mobilePaymentTrustWrap}>
                  {trustAndPolicies}
                </div>

                <div className={styles.stepDesktopActions}>
                  <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => moveToStep(2)} className={styles.stepBackBtn}>
                    <ArrowLeftIcon className={styles.icon16} /> Back to Summary
                  </Button>
                  <Button type="submit" size="lg" disabled={pending || placeholder} className={styles.stepContinueBtn}>
                    {pending ? (
                      <span className={styles.payBtnBusySpan}>
                        <Loader2Icon className={styles.spinSmSvg} /> Placing order…
                      </span>
                    ) : shop.paymentMode === "gateway" ? (
                      <>Pay {formatPrice(shownCharges.total)} &amp; place order</>
                    ) : (
                      <>Confirm payment &amp; place order</>
                    )}
                  </Button>
                </div>
              </section>
            )}
          </div>

          {/* RIGHT SIDEBAR: Context-aware per step!
              - Step 1 (Delivery): Lightweight Order & Price preview (no promo distraction)
              - Step 2 (Order Summary): Price Breakdown + Free Shipping bar
              - Step 3 (Payment): Clean LOCKED Final Summary (Delivery + Items + Applied Promo pill + Final Total + Edit link, ZERO promo input) */}
          <aside className={cn(styles.summaryAside, step !== 2 && styles.summaryAsideDesktopOnly)}>
            {step === 3 ? (
              <>
                <div className={styles.lockedAsideHeader}>
                  <h2 className={styles.summaryHeading}>Final order summary</h2>
                  <button type="button" onClick={() => moveToStep(2)} className={styles.editLockedLinkBtn}>
                    Edit
                  </button>
                </div>

                <div className={styles.lockedDeliveryBox}>
                  <div className={styles.lockedDeliveryTop}>
                    <span className={styles.lockedDeliveryLabel}>
                      <MapPinIcon className={styles.recapPinSvg} aria-hidden /> Delivering to
                    </span>
                    <button type="button" onClick={() => moveToStep(1)} className={styles.editLockedLinkBtn}>
                      Change
                    </button>
                  </div>
                  <p className={styles.lockedDeliveryName}>
                    {deliveryRecap.name}
                    {deliveryRecap.phone ? ` · +91 ${deliveryRecap.phone}` : ""}
                  </p>
                  <p className={styles.lockedDeliveryAddr}>{deliveryRecap.line}</p>
                </div>

                <ul className={styles.miniItemsList}>
                  {shown.map((l) => (
                    <li key={cartLineKey(l)} className={styles.miniItemRow}>
                      <div className={styles.miniThumbWrap}>
                        <ProductImage src={l.image} alt={l.name} sizes="40px" />
                        <span className={styles.miniQtyBubble}>{l.quantity}</span>
                      </div>
                      <span className={styles.miniItemTextCol}>
                        <span className={styles.miniItemName}>{l.name}</span>
                        {l.variantLabel && <span className={styles.miniItemVariant}>{l.variantLabel}</span>}
                      </span>
                      <span className={styles.miniItemPrice}>{formatPrice(l.price * l.quantity)}</span>
                    </li>
                  ))}
                </ul>

                {appliedPromo && !promoBelowMin && (
                  <p className={styles.lockedPromoBadge}>
                    <TicketPercentIcon className={styles.ticketSvg} aria-hidden />
                    <span>
                      <strong className={styles.monoCode}>{appliedPromo.code}</strong> applied · Saving {formatPrice(shownCharges.discountAmount ?? 0)}
                    </span>
                  </p>
                )}

                <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Final amount" className={styles.breakdownTopBorder} />
                {trustAndPolicies}
              </>
            ) : (
              <>
                <h2 className={styles.summaryHeading}>Price summary</h2>
                <FreeShippingBar subtotal={shownCharges.subtotal} />
                {step === 1 && (
                  <ul className={styles.miniItemsList}>
                    {shown.slice(0, 3).map((l) => (
                      <li key={cartLineKey(l)} className={styles.miniItemRow}>
                        <div className={styles.miniThumbWrap}>
                          <ProductImage src={l.image} alt={l.name} sizes="40px" />
                          <span className={styles.miniQtyBubble}>{l.quantity}</span>
                        </div>
                        <span className={styles.miniItemTextCol}>
                        <span className={styles.miniItemName}>{l.name}</span>
                        {l.variantLabel && <span className={styles.miniItemVariant}>{l.variantLabel}</span>}
                      </span>
                        <span className={styles.miniItemPrice}>{formatPrice(l.price * l.quantity)}</span>
                      </li>
                    ))}
                    {shown.length > 3 && (
                      <li className={styles.miniMoreNote}>+{shown.length - 3} more item{shown.length - 3 === 1 ? "" : "s"}</li>
                    )}
                  </ul>
                )}
                {appliedPromo && !promoBelowMin && (
                  <p className={styles.lockedPromoBadge}>
                    <TicketPercentIcon className={styles.ticketSvg} aria-hidden />
                    <span>
                      <strong className={styles.monoCode}>{appliedPromo.code}</strong> applied · Saving {formatPrice(shownCharges.discountAmount ?? 0)}
                    </span>
                  </p>
                )}
                <PriceBreakdown {...shownCharges} itemCount={shownCount} totalLabel="Total to pay" className={styles.breakdownTopBorder} />
                {trustAndPolicies}
              </>
            )}
          </aside>

          {/* NATIVE MOBILE APP STICKY BOTTOM BAR (< 900px) */}
          <div data-mobile-bottom-bar className={cn(styles.mobileBottomBar, "glass")}>
            {step !== 2 ? (
              <button
                type="button"
                onClick={() => {
                  setMobileSummaryOpen((v) => !v)
                  stepperTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                }}
                className={styles.mobileTotalTrigger}
              >
                <span className={styles.mobileTotalValue}>{formatPrice(shownCharges.total)}</span>
                <span className={styles.mobileViewDetailsLink}>
                  {mobileSummaryOpen ? "Hide details" : "View details"}
                </span>
              </button>
            ) : (
              <div className={styles.mobileTotalCol}>
                <span className={styles.mobileTotalValue}>{formatPrice(shownCharges.total)}</span>
                <span className={styles.mobileTotalLabel}>
                  {shownCount} {shownCount === 1 ? "item" : "items"}
                </span>
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={pending || placeholder}
              className={styles.mobilePayBtn}
            >
              {pending ? (
                <span className={styles.mobilePayBusySpan}>
                  <Loader2Icon className={styles.spinSmSvg} /> Placing…
                </span>
              ) : (
                <span className={styles.mobilePayCtaInner}>
                  <span>{mobileCtaLabel}</span>
                  {step < 3 && <ArrowRightIcon className={styles.icon16} />}
                </span>
              )}
            </Button>
          </div>
        </form>
      </div>

      <LegalQuickModal open={legalModalOpen} onOpenChange={setLegalModalOpen} initialTab={legalModalTab} />

      <Dialog
        open={addressModal !== null}
        onOpenChange={(next) => {
          if (savingAddr) return
          if (!next) setAddressModal(null)
        }}
        onBackStep={() => {
          if (savingAddr) return true
          if (addressModal === "new" && openedNewFromList) {
            setAddressModal("list")
            return true
          }
          return false
        }}
      >
        <DialogContent mobileFullScreen className={styles.addrModalContent}>
          <DialogHeader>
            <DialogTitle>
              {addressModal === "list"
                ? "Choose delivery address"
                : editingOneTime && oneTimeAddress
                  ? "Edit delivery address"
                  : "Add new delivery address"}
            </DialogTitle>
            <DialogDescription>
              {addressModal === "list"
                ? "Select one of your saved addresses or add a new one for this order."
                : "Enter where we should deliver your order."}
            </DialogDescription>
          </DialogHeader>

          {addressModal === "list" ? (
            <>
              <DialogBody resetScrollKey="list" className={styles.addrModalBody}>
                <div role="radiogroup" aria-label="Saved delivery addresses" className={styles.addrRadioList}>
                  {addresses.map((a) => {
                    const active = selected === a.id
                    return (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          fillFrom(a)
                          setAddressModal(null)
                        }}
                        className={cn(styles.addrRadioCard, active && styles.addrRadioCardActive)}
                      >
                        <span className={styles.radioCircle} aria-hidden>
                          {active && <CheckIcon className={styles.checkTinySvg} />}
                        </span>
                        <span className={styles.radioBodyCol}>
                          <span className={styles.addrTitleRow}>
                            <MapPinIcon className={styles.pinSvg} aria-hidden />
                            <span>{a.label}</span>
                            {a.isDefault && <span className={styles.defaultBadge}>Default</span>}
                          </span>
                          <span className={styles.addrPersonLine}>
                            {a.fullName} <span className={styles.addrPhoneMuted}>· +91 {a.phone}</span>
                          </span>
                          <span className={styles.addrStreetLine}>
                            {a.address}, {a.city} - {a.pincode}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                  {oneTimeAddress && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={selected === "new"}
                      onClick={() => {
                        applyOneTimeAddress(oneTimeAddress)
                        setAddressModal(null)
                      }}
                      className={cn(styles.addrRadioCard, selected === "new" && styles.addrRadioCardActive)}
                    >
                      <span className={styles.radioCircle} aria-hidden>
                        {selected === "new" && <CheckIcon className={styles.checkTinySvg} />}
                      </span>
                      <span className={styles.radioBodyCol}>
                        <span className={styles.addrTitleRow}>
                          <MapPinIcon className={styles.pinSvg} aria-hidden />
                          <span className={styles.oneTimeBadge}>One-time address</span>
                        </span>
                        <span className={styles.addrPersonLine}>
                          {oneTimeAddress.fullName} <span className={styles.addrPhoneMuted}>· +91 {oneTimeAddress.phone}</span>
                        </span>
                        <span className={styles.addrStreetLine}>
                          {oneTimeAddress.address}, {joinCityState(oneTimeAddress.city, oneTimeAddress.state)} - {oneTimeAddress.pincode}
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" size="lg" onClick={() => setAddressModal(null)} className={styles.footerBackBtn}>
                  Cancel
                </Button>
                <Button type="button" size="lg" onClick={() => openNewAddressModal(true)} className={styles.footerConfirmBtn}>
                  <PlusIcon className={styles.icon16} /> Add new address
                </Button>
              </DialogFooter>
            </>
          ) : addressModal === "new" ? (
            <CheckoutAddressModalBody
              key={addrModalKey}
              initial={
                editingOneTime && oneTimeAddress
                  ? oneTimeAddress
                  : {
                      fullName: activeProfile?.fullName || addresses[0]?.fullName || "",
                      phone: activeProfile?.phone || addresses[0]?.phone || "",
                    }
              }
              canSaveMore={addresses.length < MAX_ADDRESSES}
              saving={savingAddr}
              openedFromList={openedNewFromList}
              onBackToList={() => setAddressModal("list")}
              onCancel={() => setAddressModal(null)}
              onSubmitAddress={handleModalAddressSubmit}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
  return preview || ready ? view : <Skeletonize>{view}</Skeletonize>
}

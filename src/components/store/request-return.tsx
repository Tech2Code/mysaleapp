"use client"

import {
  AlertCircleIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CheckIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PackageOpenIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Undo2Icon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/form"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { listMyAddresses, saveAddress } from "@/features/addresses/actions"
import { ADDRESS_LABELS, type Address } from "@/features/addresses/types"
import { joinCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { requestReturn, withdrawReturnRequest } from "@/features/orders/actions"
import { OTHER_DETAIL_MESSAGE, OTHER_DETAIL_MIN, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { isOpenRequest, itemReturnWindow, requestStatusMeta, returnableQuantities, returnLineKey, splitReturnDetails } from "@/features/orders/returns"
import { ReturnsList } from "@/components/shared/returns-list"
import { netReturnRefund, notRefundedCharges, refundLines } from "@/features/orders/refund"
import type { OrderFee, OrderItem, OrderReturn, OrderStatus, ReturnRequest, ReturnResolutionType, StatusHistoryEntry } from "@/features/orders/types"
import { formatDate, formatDateTime, formatPrice, normalizeIndianPhone } from "@/lib/format"
import { cn } from "@/lib/utils"
import { TONES } from "@/components/shared/status-badge"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"
import { LIMITS, PATTERNS } from "@/lib/validation"
import { ProductImage } from "./product-image"
import styles from "./request-return.module.css"

type Window = { open: boolean; until: string | null; days: number }
type WizardStep = 1 | 2 | 3

const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Items & Reason" },
  { step: 2, label: "Resolution" },
  { step: 3, label: "Pickup & Confirm" },
]

const COMBINED_REASONS: { label: string; sub: string; defaultChoice: "refund" | "replacement" | "exchange" }[] = [
  {
    label: "Damaged or broken",
    sub: "Item arrived cracked, chipped, or damaged in transit",
    defaultChoice: "replacement",
  },
  {
    label: "Wrong item received",
    sub: "Delivered piece is different from what was ordered",
    defaultChoice: "replacement",
  },
  {
    label: "Not as described",
    sub: "Size, colour, or details differ from the product page",
    defaultChoice: "refund",
  },
  {
    label: "Need a different size or dimensions",
    sub: "Want to swap for another size or variant",
    defaultChoice: "exchange",
  },
  {
    label: "Prefer a different colour or finish",
    sub: "Want to exchange for another colour or design",
    defaultChoice: "exchange",
  },
  {
    label: "Quality isn't what I expected",
    sub: "Material or finish did not meet expectations",
    defaultChoice: "refund",
  },
  {
    label: "Changed my mind",
    sub: "No longer need this item",
    defaultChoice: "refund",
  },
  {
    label: OTHER_REASON,
    sub: "Another reason not listed above",
    defaultChoice: "refund",
  },
]

/**
 * "Request return or exchange" dialog on a delivered order.
 * Desktop (`>= 640px`): clean centered modal. Mobile (`< 640px`): full-screen native app sheet via `DialogContent mobileFullScreen`.
 */
export function RequestReturn({
  orderCode,
  phoneLast4,
  status,
  items,
  history = [],
  returns,
  requests,
  window: win,
  whatsappUrl,
  onDone,
  charges,
  orderDelivery,
}: {
  charges?: { shippingFee: number; extraFees: OrderFee[]; discountAmount?: number; paidAmount?: number; refundedAmount?: number }
  orderDelivery?: { name: string; phone: string; address: string; city: string; pincode: string } | null
  orderCode: string
  phoneLast4?: string
  status: OrderStatus
  items: OrderItem[]
  history?: StatusHistoryEntry[]
  returns: OrderReturn[]
  requests: ReturnRequest[]
  window: Window
  whatsappUrl: string
  onDone?: () => void | Promise<unknown>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<WizardStep>(1)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [resolutionType, setResolutionType] = useState<ReturnResolutionType>("refund")
  const [exchangeKind, setExchangeKind] = useState<"" | "exchange" | "replacement">("")
  const [userPickedResolution, setUserPickedResolution] = useState(false)
  const [exchangePreference, setExchangePreference] = useState("")
  const [reason, setReason] = useState<string>("")
  const [details, setDetails] = useState("")
  const [refundMode, setRefundMode] = useState<"original" | "upi">("original")
  const [refundUpiId, setRefundUpiId] = useState("")
  const [phone, setPhone] = useState("")
  const [pickupMode, setPickupMode] = useState<"order" | "saved" | "new">("order")
  const [dialogView, setDialogView] = useState<"main" | "pickup-list" | "pickup-new">("main")
  const [pickupSubmitted, setPickupSubmitted] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")
  const [pickupName, setPickupName] = useState(orderDelivery?.name ?? "")
  const [pickupPhone, setPickupPhone] = useState(orderDelivery?.phone ?? "")
  const [pickupAddressLine, setPickupAddressLine] = useState("")
  const [pickupCity, setPickupCity] = useState("")
  const [pickupState, setPickupState] = useState<IndianState | "">("")
  const [pickupPincode, setPickupPincode] = useState("")
  const [saveNewPickupAddress, setSaveNewPickupAddress] = useState(false)
  const [newAddressLabel, setNewAddressLabel] = useState<(typeof ADDRESS_LABELS)[number]>("Home")
  const [step1Attempted, setStep1Attempted] = useState(false)
  const [step2Attempted, setStep2Attempted] = useState(false)
  const [step3Attempted, setStep3Attempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const [errorShakeKey, setErrorShakeKey] = useState(0)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const itemsSectionRef = useRef<HTMLDivElement>(null)
  const reasonBoxRef = useRef<HTMLDivElement>(null)
  const detailsBoxRef = useRef<HTMLDivElement>(null)
  const exchangeBoxRef = useRef<HTMLDivElement>(null)
  const exchangePrefBoxRef = useRef<HTMLDivElement>(null)
  const refundUpiBoxRef = useRef<HTMLDivElement>(null)
  const pickupBoxRef = useRef<HTMLDivElement>(null)
  const guestPhoneBoxRef = useRef<HTMLDivElement>(null)
  const newPickupFormRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  useRevealOnChange(requests.map((r) => `${r.id}:${r.status}`).join(","))

  const isGuest = phoneLast4 !== undefined

  const pickupArea = usePincodeLookup({
    pincode: pickupPincode,
    getCity: () => pickupCity,
    setCity: (city) => setPickupCity(city),
    getState: () => pickupState,
    setState: (state) => setPickupState(state as IndianState),
  })

  useEffect(() => {
    if (!open || isGuest) return
    let cancelled = false
    listMyAddresses()
      .then((list) => {
        if (cancelled) return
        setSavedAddresses(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, isGuest])

  // Never read the clock synchronously during render (Next.js Cache Components forbids `new Date()` in Client Component prerenders).
  const [clientNow, setClientNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- populate client clock after mount
    setClientNow(new Date())
  }, [])

  const resetFormState = useCallback(() => {
    setStep(1)
    setQty({})
    setResolutionType("refund")
    setExchangeKind("")
    setUserPickedResolution(false)
    setExchangePreference("")
    setReason("")
    setDetails("")
    setRefundMode("original")
    setRefundUpiId("")
    setPhone("")
    setPickupMode("order")
    setDialogView("main")
    setPickupSubmitted(false)
    setSelectedAddressId("")
    setPickupName(orderDelivery?.name ?? "")
    setPickupPhone(orderDelivery?.phone ?? "")
    setPickupAddressLine("")
    setPickupCity("")
    setPickupState("")
    setPickupPincode("")
    setSaveNewPickupAddress(false)
    setNewAddressLabel("Home")
    setStep1Attempted(false)
    setStep2Attempted(false)
    setStep3Attempted(false)
    setTouched({})
    setServerFieldErrors({})
  }, [orderDelivery?.name, orderDelivery?.phone])

  useEffect(() => {
    return () => {
      setOpen(false)
      resetFormState()
    }
  }, [resetFormState])

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const allLines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => {
      const key = returnLineKey(i)
      return !seen.has(key) && seen.add(key) && (left.get(key) ?? 0) > 0
    })
  }, [items, left])

  const windowByProduct = useMemo(() => {
    const map = new Map<string, { until: Date | null; open: boolean; days: number }>()
    for (const i of allLines) {
      const key = returnLineKey(i)
      if (history.length > 0) {
        const itemWin = itemReturnWindow(history, i.returnWindowDays, win.days, clientNow)
        map.set(key, { ...itemWin, open: win.open && itemWin.open })
      } else {
        const d = i.returnWindowDays == null ? win.days : Math.max(0, Math.trunc(Number(i.returnWindowDays)))
        map.set(key, { until: win.until ? new Date(win.until) : null, open: d > 0 && win.open, days: d })
      }
    }
    return map
  }, [allLines, history, win.days, win.open, win.until, clientNow])

  const lines = useMemo(
    () =>
      allLines.filter((i) => {
        const key = returnLineKey(i)
        return (windowByProduct.get(key)?.open ?? win.open) && (windowByProduct.get(key)?.days ?? win.days) > 0
      }),
    [allLines, windowByProduct, win.open, win.days]
  )

  // Default the first returnable item to "1" until the customer explicitly edits or clears it.
  const qtyOf = (key: string) => {
    if (qty[key] !== undefined) return qty[key]
    if (lines[0] && returnLineKey(lines[0]) === key) return "1"
    return ""
  }

  if (status !== "delivered") return null
  if (requests.some(isOpenRequest) || allLines.length === 0) return null

  if (win.days <= 0) {
    return (
      <p className={styles.closedNoticeBox}>
        {allLines.length === 1 ? "This item is non-returnable." : "Items in this order are non-returnable."} If something arrived damaged in transit,{" "}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.waLink}>
          message us on WhatsApp
        </a>
        .
      </p>
    )
  }

  if (!win.open || lines.length === 0) {
    return (
      <p className={styles.closedNoticeBox}>
        The {win.days}-day return &amp; exchange window for this order has ended{win.until ? ` (${formatDate(win.until)})` : ""}. If something is wrong with your order,{" "}
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={styles.waLink}>
          message us on WhatsApp
        </a>
        .
      </p>
    )
  }

  const payload = lines
    .map((i) => ({
      productId: i.productId,
      ...(i.variantId ? { variantId: i.variantId } : {}),
      quantity: Number(qtyOf(returnLineKey(i))) || 0,
    }))
    .filter((i) => i.quantity > 0)
  const estimate = refundLines(
    items,
    payload.map((p) => ({
      ...p,
      name:
        items.find((o) => returnLineKey(o) === returnLineKey(p))?.name ??
        items.find((o) => o.productId === p.productId)?.name ??
        "",
    }))
  )
  const refundEstimateTotal = netReturnRefund(items, payload, {
    discountAmount: charges?.discountAmount ?? 0,
    paidAmount: charges?.paidAmount,
    alreadyRefunded: charges?.refundedAmount,
    priorReturnedLines: returns.filter((r) => r.refunded).flatMap((r) => r.items),
  })
  const kept = charges ? notRefundedCharges(charges) : []
  const needsDetail = !reason || otherNeedsDetail(reason, details)
  const needsExchangeKind = resolutionType === "exchange" && !exchangeKind
  const cleanExchangePref = exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "").trim()
  // Replacement is always the exact same item (same size & colour); note is optional.
  const needsExchangePref = resolutionType === "exchange" && exchangeKind === "exchange" && cleanExchangePref.length < 2
  const cleanRefundUpi = refundUpiId.trim()
  const refundUpiError =
    resolutionType === "refund" && refundMode === "upi"
      ? !cleanRefundUpi
        ? "Enter your UPI ID for the refund (e.g. name@bank)"
        : !PATTERNS.upiId.test(cleanRefundUpi)
          ? "Enter a valid UPI ID, like name@okaxis"
          : undefined
      : undefined
  const refundUpiInvalid = Boolean(refundUpiError)
  const tooMany = payload.some((p) => p.quantity > (left.get(p.productId) ?? 0))

  // Guests on /track pass phoneLast4 and must prove their full 10-digit mobile number to request a return;
  // signed-in owners on /account/orders/[code] omit phoneLast4 and are recognised by their session.
  const phoneDigits = normalizeIndianPhone(phone)
  const phoneError =
    isGuest && phone.trim() && !phoneDigits
      ? "Enter your 10-digit mobile number"
      : isGuest && phoneDigits && !phoneDigits.endsWith(phoneLast4)
        ? "Doesn't match the number you looked up"
        : undefined
  const phoneMissing = isGuest && (!phoneDigits || Boolean(phoneError))

  const pickupPhoneDigits = normalizeIndianPhone(pickupPhone)
  const rawNewPickupErrors = {
    name:
      pickupName.trim().length < LIMITS.personName.min
        ? "Enter contact name"
        : !PATTERNS.personName.test(pickupName.trim())
          ? "Use letters, spaces and basic punctuation only"
          : undefined,
    phone: !pickupPhoneDigits ? "Enter a valid 10-digit mobile number" : undefined,
    pincode: !/^\d{6}$/.test(pickupPincode.trim())
      ? "Enter a valid 6-digit pincode"
      : pickupArea.error ?? undefined,
    city:
      pickupCity.trim().length < LIMITS.city.min
        ? "Enter city / district"
        : !PATTERNS.city.test(pickupCity.trim())
          ? "Letters, spaces and basic punctuation only"
          : undefined,
    state: !pickupState ? "Select state" : undefined,
    address:
      pickupAddressLine.trim().length < LIMITS.address.min
        ? `Enter full pickup address (at least ${LIMITS.address.min} characters)`
        : undefined,
  }
  const hasRawNewPickupError = Boolean(
    rawNewPickupErrors.name ||
      rawNewPickupErrors.phone ||
      rawNewPickupErrors.pincode ||
      rawNewPickupErrors.city ||
      rawNewPickupErrors.state ||
      rawNewPickupErrors.address
  )
  const hasNewPickupError = pickupMode === "new" && hasRawNewPickupError
  const savedPickupMissing = pickupMode === "saved" && !savedAddresses.some((a) => a.id === selectedAddressId)
  const chosenSavedAddress = savedAddresses.find((a) => a.id === selectedAddressId)

  const resolvedPickupSummary = (() => {
    if (pickupMode === "saved") {
      if (!chosenSavedAddress) return undefined
      const prefix = `${chosenSavedAddress.label}: ${chosenSavedAddress.fullName.slice(0, 40)} (+91 ${chosenSavedAddress.phone}), `
      const suffix = `, ${chosenSavedAddress.city.slice(0, 40)} - ${chosenSavedAddress.pincode}`
      const maxAddr = Math.max(30, 215 - prefix.length - suffix.length)
      return `${prefix}${chosenSavedAddress.address.slice(0, maxAddr)}${suffix}`
    }
    if (pickupMode === "new" && !hasRawNewPickupError && pickupPhoneDigits && pickupState) {
      const prefix = `${pickupName.trim().slice(0, 40)} (+91 ${pickupPhoneDigits}), `
      const suffix = `, ${joinCityState(pickupCity.trim(), pickupState).slice(0, 45)} - ${pickupPincode.trim()}`
      const maxAddr = Math.max(30, 215 - prefix.length - suffix.length)
      return `${prefix}${pickupAddressLine.trim().slice(0, maxAddr)}${suffix}`
    }
    return undefined
  })()

  const submitButtonLabel =
    resolutionType === "refund"
      ? "Submit return request"
      : exchangeKind === "replacement"
        ? "Submit replacement request"
        : "Submit exchange request"

  const scrollAndFocus = (el: HTMLElement | null, focusInput = false) => {
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    if (focusInput) {
      setTimeout(() => {
        const input = el.querySelector<HTMLElement>("input, textarea, button[role='combobox']")
        input?.focus({ preventScroll: true })
      }, 180)
    }
  }

  const goStep2 = () => {
    setStep1Attempted(true)
    setServerFieldErrors({})
    if (payload.length === 0 || tooMany) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(itemsSectionRef.current)
      return
    }
    if (!reason) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(reasonBoxRef.current)
      return
    }
    if (needsDetail) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(detailsBoxRef.current ?? reasonBoxRef.current, true)
      return
    }
    // Pre-select the natural resolution for the chosen reason unless the customer already picked one
    if (!userPickedResolution) {
      const matched = COMBINED_REASONS.find((r) => r.label === reason)
      if (matched?.defaultChoice === "replacement") {
        setResolutionType("exchange")
        setExchangeKind("replacement")
        setExchangePreference("")
      } else if (matched?.defaultChoice === "exchange") {
        setResolutionType("exchange")
        setExchangeKind("exchange")
      } else {
        setResolutionType("refund")
        setExchangeKind("")
      }
    }
    setStep1Attempted(false)
    setStep2Attempted(false)
    setStep(2)
  }

  const goStep3 = () => {
    setStep2Attempted(true)
    setServerFieldErrors({})
    if (needsExchangeKind) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(exchangeBoxRef.current)
      return
    }
    if (refundUpiInvalid) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(refundUpiBoxRef.current ?? exchangeBoxRef.current, true)
      return
    }
    if (needsExchangePref) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(exchangePrefBoxRef.current ?? exchangeBoxRef.current, true)
      return
    }
    setStep2Attempted(false)
    setStep3Attempted(false)
    setStep(3)
  }

  const submit = () => {
    setStep3Attempted(true)
    setServerFieldErrors({})
    if (payload.length === 0 || tooMany || !reason || needsDetail) {
      setErrorShakeKey((k) => k + 1)
      setStep1Attempted(true)
      setStep(1)
      return
    }
    if (needsExchangeKind || needsExchangePref || refundUpiInvalid) {
      setErrorShakeKey((k) => k + 1)
      setStep2Attempted(true)
      setStep(2)
      return
    }
    if (hasNewPickupError || savedPickupMissing) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(pickupBoxRef.current)
      return
    }
    if (phoneMissing) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(guestPhoneBoxRef.current ?? pickupBoxRef.current, true)
      return
    }
    startTransition(async () => {
      try {
        const rawPref = exchangePreference.trim().replace(/^(Replacement|Exchange)\s*:\s*/i, "")
        const formattedPref =
          resolutionType === "exchange"
            ? exchangeKind === "replacement"
              ? rawPref
                ? `Replacement: Same item, same size & colour — ${rawPref}`
                : "Replacement: Same item, same size & colour"
              : `Exchange: ${rawPref}`
            : undefined
        const res = await requestReturn({
          code: orderCode,
          phoneLast4,
          phone: isGuest ? phoneDigits ?? undefined : undefined,
          items: payload,
          reason,
          details: details.trim() || undefined,
          resolutionType,
          exchangePreference: formattedPref,
          pickupAddress: resolvedPickupSummary,
          refundUpiId: resolutionType === "refund" && refundMode === "upi" ? cleanRefundUpi : undefined,
        })
        if (!res.ok) {
          const nextFieldErrors: Record<string, string> = {}
          for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
            if (msgs?.[0]) nextFieldErrors[k] = msgs[0]
          }
          setServerFieldErrors(nextFieldErrors)
          if (nextFieldErrors.reason || nextFieldErrors.details || nextFieldErrors.items) {
            setStep(1)
          } else if (nextFieldErrors.exchangePreference || nextFieldErrors.refundUpiId) {
            setStep(2)
          }
          toast.error(res.error)
          return
        }
        if (pickupMode === "new" && saveNewPickupAddress && !isGuest && pickupPhoneDigits && pickupState) {
          const saveRes = await saveAddress(null, {
            label: newAddressLabel,
            fullName: pickupName.trim(),
            phone: pickupPhoneDigits,
            address: pickupAddressLine.trim(),
            city: pickupCity.trim(),
            state: pickupState,
            pincode: pickupPincode.trim(),
            isDefault: false,
          }).catch(() => null)
          if (saveRes && !saveRes.ok) {
            toast.info(`Could not save address to address book: ${saveRes.error}`)
          }
        }
        const submittedKind = resolutionType === "exchange" ? (exchangeKind === "replacement" ? "replacement" : "exchange") : "refund"
        setOpen(false)
        resetFormState()
        if (onDone) {
          await onDone()
        } else {
          router.refresh()
        }
        later(() => {
          toast.success(
            submittedKind === "replacement"
              ? "Replacement request sent. We'll review it and update you here."
              : submittedKind === "exchange"
                ? "Exchange request sent. We'll review it and update you here."
                : "Return request sent. We'll review it and update you here."
          )
        })
      } catch {
        toast.error("Couldn't submit your request. Please try again.")
      }
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (pending) return
    setOpen(next)
    if (!next) resetFormState()
  }

  const handleBackStep = () => {
    if (pending) return true
    if (dialogView === "pickup-new") {
      setPickupSubmitted(false)
      setDialogView("pickup-list")
      return true
    }
    if (dialogView === "pickup-list") {
      setDialogView("main")
      return true
    }
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep)
      return true
    }
    return false
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange} onBackStep={handleBackStep}>
        <DialogTrigger className={styles.returnTriggerBtn}>
          <Undo2Icon className={styles.triggerIcon} aria-hidden /> Request return or exchange
        </DialogTrigger>
        <DialogContent mobileFullScreen className={styles.returnDialog}>
          <DialogHeader>
            <DialogTitle>
              {dialogView === "pickup-list"
                ? "Choose pickup address"
                : dialogView === "pickup-new"
                  ? "Add new pickup address"
                  : step === 1
                    ? "Select items & reason"
                    : step === 2
                      ? "Choose your resolution"
                      : "Confirm pickup & review"}
            </DialogTitle>
            <DialogDescription>
              {dialogView === "pickup-list"
                ? "Select where our courier should pick up the item(s), or add a new pickup address."
                : dialogView === "pickup-new"
                  ? "Enter the address where our courier should collect the item(s)."
                  : step === 1
                    ? "Pick the item(s) you want to return or exchange and tell us what happened."
                    : step === 2
                      ? "Select whether you want a refund, a same-item replacement, or an exchange."
                      : "Check your pickup address and summary before submitting."}
            </DialogDescription>
          </DialogHeader>

          {dialogView === "pickup-list" ? (
            <>
              <DialogBody resetScrollKey="pickup-list">
                <div role="radiogroup" aria-label="Pickup address" className={styles.pickupRadioGroup}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={pickupMode === "order"}
                    onClick={() => {
                      setPickupMode("order")
                      setDialogView("main")
                    }}
                    className={cn(styles.pickupRadioCard, pickupMode === "order" && styles.pickupRadioCardSelected)}
                  >
                    <span className={styles.radioCircle} aria-hidden>
                      {pickupMode === "order" && <CheckIcon className={styles.checkTinySvg} />}
                    </span>
                    <span className={styles.radioContentCol}>
                      <span className={styles.radioHeaderRow}>
                        <span className={styles.primaryTagPill}>Order delivery address</span>
                        {orderDelivery && <span>{orderDelivery.name} · +91 {orderDelivery.phone}</span>}
                      </span>
                      {orderDelivery ? (
                        <span className={styles.radioSubText}>
                          {orderDelivery.address}, {orderDelivery.city} - {orderDelivery.pincode}
                        </span>
                      ) : (
                        <span className={styles.radioSubText}>Same address where this order was delivered</span>
                      )}
                    </span>
                  </button>

                  {savedAddresses
                    .filter(
                      (a) =>
                        !orderDelivery ||
                        a.pincode.trim() !== orderDelivery.pincode.trim() ||
                        a.address.trim().toLowerCase() !== orderDelivery.address.trim().toLowerCase()
                    )
                    .map((addr) => {
                      const selected = pickupMode === "saved" && selectedAddressId === addr.id
                      return (
                        <button
                          key={addr.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setPickupMode("saved")
                            setSelectedAddressId(addr.id)
                            setDialogView("main")
                          }}
                          className={cn(styles.pickupRadioCard, selected && styles.pickupRadioCardSelected)}
                        >
                          <span className={styles.radioCircle} aria-hidden>
                            {selected && <CheckIcon className={styles.checkTinySvg} />}
                          </span>
                          <span className={styles.radioContentCol}>
                            <span className={styles.radioHeaderRow}>
                              <span className={styles.secondaryTagPill}>{addr.label}</span>
                              {addr.fullName} · +91 {addr.phone}
                            </span>
                            <span className={styles.radioSubText}>
                              {addr.address}, {addr.city} - {addr.pincode}
                            </span>
                          </span>
                        </button>
                      )
                    })}

                  {!hasRawNewPickupError && pickupPhoneDigits && pickupState && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={pickupMode === "new"}
                      onClick={() => {
                        setPickupMode("new")
                        setDialogView("main")
                      }}
                      className={cn(styles.pickupRadioCard, pickupMode === "new" && styles.pickupRadioCardSelected)}
                    >
                      <span className={styles.radioCircle} aria-hidden>
                        {pickupMode === "new" && <CheckIcon className={styles.checkTinySvg} />}
                      </span>
                      <span className={styles.radioContentCol}>
                        <span className={styles.radioHeaderRow}>
                          <span className={styles.secondaryTagPill}>
                            {saveNewPickupAddress ? newAddressLabel : "New address"}
                          </span>
                          {pickupName.trim()} · +91 {pickupPhoneDigits}
                        </span>
                        <span className={styles.radioSubText}>
                          {pickupAddressLine.trim()}, {joinCityState(pickupCity.trim(), pickupState)} - {pickupPincode.trim()}
                        </span>
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setPickupSubmitted(false)
                      setDialogView("pickup-new")
                    }}
                    className={styles.addPickupDashBtn}
                  >
                    <PlusIcon className={styles.plusSvg} aria-hidden />
                    Add a new pickup address
                  </button>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogView("main")} className={styles.pillBtn}>
                  <ArrowLeftIcon className={styles.btnIcon} /> Back to return details
                </Button>
              </DialogFooter>
            </>
          ) : dialogView === "pickup-new" ? (
            <>
              <DialogBody resetScrollKey="pickup-new">
                <div ref={newPickupFormRef} className={styles.newPickupForm}>
                  <div className={styles.twoColFields}>
                    <TextField
                      label="Contact name *"
                      kind="personName"
                      fieldSize="md"
                      value={pickupName}
                      onChange={(e) => setPickupName(e.target.value)}
                      onBlur={() => markTouched("pickupName")}
                      error={(pickupSubmitted || touched.pickupName) ? rawNewPickupErrors.name : undefined}
                    />
                    <TextField
                      label="Mobile number *"
                      kind="phone"
                      leading="+91"
                      fieldSize="md"
                      value={pickupPhone}
                      onChange={(e) => setPickupPhone(e.target.value)}
                      onBlur={() => markTouched("pickupPhone")}
                      error={(pickupSubmitted || touched.pickupPhone) ? rawNewPickupErrors.phone : undefined}
                    />
                  </div>
                  <div className={styles.twoColFields}>
                    <TextField
                      label="Pincode *"
                      kind="pincode"
                      fieldSize="md"
                      value={pickupPincode}
                      onChange={(e) => setPickupPincode(e.target.value)}
                      onBlur={() => markTouched("pickupPincode")}
                      hint={pickupArea.hint}
                      error={(pickupSubmitted || touched.pickupPincode || pickupPincode.length === 6) ? rawNewPickupErrors.pincode : undefined}
                    />
                    <TextField
                      label="City / District *"
                      kind="city"
                      fieldSize="md"
                      value={pickupCity}
                      onChange={(e) => setPickupCity(e.target.value)}
                      onBlur={() => markTouched("pickupCity")}
                      error={(pickupSubmitted || touched.pickupCity) ? rawNewPickupErrors.city : undefined}
                    />
                  </div>
                  <SelectField
                    label="State *"
                    placeholder="Select state"
                    fieldSize="md"
                    value={pickupState}
                    onValueChange={(val) => {
                      setPickupState(val as IndianState)
                      markTouched("pickupState")
                    }}
                    options={STATE_OPTIONS}
                    error={(pickupSubmitted || touched.pickupState) ? rawNewPickupErrors.state : undefined}
                  />
                  <TextAreaField
                    label="Full pickup address *"
                    rows={2}
                    maxLength={120}
                    placeholder="House / flat no., building, street, area & landmark"
                    value={pickupAddressLine}
                    onChange={(e) => setPickupAddressLine(e.target.value)}
                    onBlur={() => markTouched("pickupAddress")}
                    error={(pickupSubmitted || touched.pickupAddress) ? rawNewPickupErrors.address : undefined}
                  />
                  {!isGuest && savedAddresses.length < 10 && (
                    <div className={styles.saveAddrBox}>
                      <CheckboxField
                        checked={saveNewPickupAddress}
                        onCheckedChange={setSaveNewPickupAddress}
                        label="Save this address to my address book"
                      />
                      {saveNewPickupAddress && (
                        <div className={styles.labelPillsRow}>
                          {ADDRESS_LABELS.map((lbl) => (
                            <button
                              key={lbl}
                              type="button"
                              onClick={() => setNewAddressLabel(lbl)}
                              className={cn(styles.labelChipBtn, newAddressLabel === lbl && styles.labelChipBtnActive)}
                            >
                              {lbl}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogBody>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPickupSubmitted(false)
                    setDialogView("pickup-list")
                  }}
                  className={styles.pillBtn}
                >
                  <ArrowLeftIcon className={styles.btnIcon} /> Back
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setPickupSubmitted(true)
                    if (hasRawNewPickupError) {
                      setTimeout(() => {
                        const invalidEl = newPickupFormRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")
                        if (invalidEl) {
                          invalidEl.scrollIntoView({ behavior: "smooth", block: "center" })
                          invalidEl.focus({ preventScroll: true })
                        }
                      }, 50)
                      return
                    }
                    setPickupMode("new")
                    setPickupSubmitted(false)
                    setDialogView("main")
                  }}
                  className={styles.pillBtn}
                >
                  <CheckIcon className={styles.btnIcon} /> Use this address
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className={styles.wizardStepperStrip}>
                <nav aria-label="Return request progress" className={styles.wizardStepsBar}>
                  {WIZARD_STEPS.map((ws) => {
                    const isCurrent = step === ws.step
                    const isDone = step > ws.step
                    return (
                      <button
                        key={ws.step}
                        type="button"
                        disabled={!isDone}
                        aria-current={isCurrent ? "step" : undefined}
                        onClick={() => {
                          if (isDone) {
                            setStep1Attempted(false)
                            setStep2Attempted(false)
                            setStep3Attempted(false)
                            setStep(ws.step)
                          }
                        }}
                        className={cn(
                          styles.wizardStepPill,
                          isCurrent && styles.wizardStepPillCurrent,
                          isDone && styles.wizardStepPillDone
                        )}
                      >
                        <span className={styles.wizardStepBadge} aria-hidden>
                          {isDone ? <CheckIcon className={styles.stepCheckSvg} /> : ws.step}
                        </span>
                        <span className={styles.wizardStepLabel}>{ws.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>

              <DialogBody resetScrollKey={step}>
              {step === 1 ? (
                <div className={styles.wizardStepStack}>
                  <div ref={itemsSectionRef} className={styles.stepSectionBlock}>
                    <div className={styles.stepSectionHeader}>
                      <p className={styles.stepSectionTitle}>1. Select item(s) &amp; quantity *</p>
                      {win.until && (
                        <span className={styles.stepSectionMeta}>Open until {formatDate(win.until)}</span>
                      )}
                    </div>
                    {step1Attempted && payload.length === 0 && (
                      <div key={`items-err-${errorShakeKey}`} role="alert" className={styles.stepErrorBanner}>
                        <AlertCircleIcon className={styles.stepErrorIcon} aria-hidden />
                        <span>Please select at least 1 item to continue.</span>
                      </div>
                    )}
                    <ul
                      className={cn(
                        styles.returnItemsList,
                        step1Attempted && payload.length === 0 && styles.returnItemsListError
                      )}
                    >
                      {allLines.map((i) => {
                        const key = returnLineKey(i)
                        const max = left.get(key) ?? 0
                        const itemWin = windowByProduct.get(key)
                        const eligible = (itemWin?.open ?? win.open) && (itemWin?.days ?? win.days) > 0
                        const currentQty = Math.min(max, Math.max(0, Number(qtyOf(key)) || 0))
                        const isChecked = eligible && currentQty > 0
                        const setItemQty = (nextNum: number) => {
                          const clamped = Math.min(max, Math.max(0, nextNum))
                          setQty((q) => ({ ...q, [key]: clamped > 0 ? String(clamped) : "0" }))
                        }
                        const windowText =
                          itemWin && itemWin.days <= 0
                            ? "Non-returnable item"
                            : itemWin && !itemWin.open
                              ? `${itemWin.days}-day return window ended${itemWin.until ? ` (${formatDate(itemWin.until)})` : ""}`
                              : itemWin
                                ? `${itemWin.days}-day return & exchange window`
                                : `${win.days}-day return & exchange window`
                        const itemCheckId = `return-item-${key}`
                        return (
                          <li
                            key={key}
                            className={cn(
                              styles.returnItemCard,
                              isChecked && styles.returnItemCardSelected,
                              !eligible && styles.returnItemIneligible
                            )}
                          >
                            {eligible ? (
                              <div className={styles.itemClickRow}>
                                <Checkbox
                                  id={itemCheckId}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => setItemQty(checked ? Math.max(1, currentQty || 1) : 0)}
                                  aria-label={`Select ${i.name}`}
                                />
                                <div className={styles.itemThumbWrap}>
                                  <ProductImage src={i.image ?? null} alt={i.name} sizes="48px" />
                                </div>
                                <label
                                  htmlFor={itemCheckId}
                                  className={cn(styles.itemInfoCol, styles.itemClickRowInteractive)}
                                >
                                  <span className={styles.itemName}>{i.name}</span>
                                  <span className={styles.itemPriceMeta}>
                                    {formatPrice(i.price)} each · Ordered: {i.quantity}
                                  </span>
                                  <span className={styles.itemWindowText}>{windowText}</span>
                                </label>
                              </div>
                            ) : (
                              <div className={styles.itemClickRow}>
                                <div className={styles.itemThumbWrap}>
                                  <ProductImage src={i.image ?? null} alt={i.name} sizes="48px" />
                                </div>
                                <div className={styles.itemInfoCol}>
                                  <p className={styles.itemName}>{i.name}</p>
                                  <p className={styles.itemPriceMeta}>
                                    {formatPrice(i.price)} each · Ordered: {i.quantity}
                                  </p>
                                  <p className={styles.itemWindowText}>{windowText}</p>
                                </div>
                              </div>
                            )}

                            {eligible ? (
                              <div className={styles.itemControlsBottom}>
                                <span className={styles.itemQtyLabel}>
                                  {isChecked ? `Returning ${currentQty} of ${max}` : `Max returnable: ${max}`}
                                </span>
                                <div className={styles.compactStepper} role="group" aria-label={`Quantity for ${i.name}`}>
                                  <button
                                    type="button"
                                    disabled={currentQty <= 0}
                                    onClick={() => setItemQty(currentQty - 1)}
                                    aria-label={`Decrease quantity for ${i.name}`}
                                    className={styles.stepperCircleBtn}
                                  >
                                    <MinusIcon className={styles.stepperSvg} />
                                  </button>
                                  <span className={styles.stepperValueText} aria-live="polite">
                                    {currentQty}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={currentQty >= max}
                                    onClick={() => setItemQty(currentQty + 1)}
                                    aria-label={`Increase quantity for ${i.name}`}
                                    className={styles.stepperCircleBtn}
                                  >
                                    <PlusIcon className={styles.stepperSvg} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <span className={styles.ineligibleBadge}>
                                {(itemWin?.days ?? 0) <= 0 ? "Non-returnable" : "Window ended"}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <div ref={reasonBoxRef} className={styles.stepSectionBlock}>
                    <p className={styles.stepSectionTitle}>2. Why are you returning or exchanging? *</p>
                    {(serverFieldErrors.reason || (step1Attempted && payload.length > 0 && !reason)) && (
                      <div key={`reason-err-${errorShakeKey}`} role="alert" className={styles.stepErrorBanner}>
                        <AlertCircleIcon className={styles.stepErrorIcon} aria-hidden />
                        <span>{serverFieldErrors.reason || "Please choose a reason below to continue."}</span>
                      </div>
                    )}
                    <div
                      role="radiogroup"
                      aria-label="Reason for return or exchange"
                      className={cn(
                        styles.reasonCardsGrid,
                        (serverFieldErrors.reason || (step1Attempted && payload.length > 0 && !reason)) && styles.reasonCardsGridError
                      )}
                    >
                      {COMBINED_REASONS.map((r) => {
                        const selected = reason === r.label
                        return (
                          <button
                            key={r.label}
                            type="button"
                            role="radio"
                            data-skeleton-card=""
                            aria-checked={selected}
                            onClick={() => {
                              setReason(r.label)
                              if (serverFieldErrors.reason) {
                                setServerFieldErrors((prev) => ({ ...prev, reason: "" }))
                              }
                              if (r.label === OTHER_REASON) {
                                requestAnimationFrame(() => {
                                  detailsBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                                })
                              }
                            }}
                            className={cn(styles.reasonRadioCard, selected && styles.reasonRadioCardSelected)}
                          >
                            <span className={styles.radioCircle} aria-hidden>
                              {selected && <CheckIcon className={styles.checkTinySvg} />}
                            </span>
                            <span className={styles.reasonCardTextCol}>
                              <span className={styles.reasonCardLabel}>{r.label}</span>
                              <span className={styles.reasonCardSub}>{r.sub}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    {reason && (
                      <div ref={detailsBoxRef}>
                        <TextAreaField
                          label={reason === OTHER_REASON ? "Please tell us the reason *" : "Additional details (optional)"}
                          required={reason === OTHER_REASON}
                          rows={2}
                          maxLength={pickupMode === "order" ? LIMITS.returnDetail.max : 140}
                          placeholder={
                            reason === OTHER_REASON
                              ? "Describe what went wrong (at least 5 characters)…"
                              : "Any extra details that help us process your request faster…"
                          }
                          value={details}
                          onChange={(e) => {
                            setDetails(e.target.value)
                            if (serverFieldErrors.details) {
                              setServerFieldErrors((prev) => ({ ...prev, details: "" }))
                            }
                          }}
                          onBlur={() => markTouched("details")}
                          error={
                            serverFieldErrors.details ||
                            ((step1Attempted || touched.details) && reason === OTHER_REASON && details.trim().length < OTHER_DETAIL_MIN
                              ? OTHER_DETAIL_MESSAGE
                              : undefined)
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : step === 2 ? (
                <div ref={exchangeBoxRef} className={styles.wizardStepStack}>
                  <div className={styles.stepSectionBlock}>
                    <p className={styles.stepSectionTitle}>How would you like us to resolve this? *</p>
                    {step2Attempted && needsExchangeKind && (
                      <div key={`res-err-${errorShakeKey}`} role="alert" className={styles.stepErrorBanner}>
                        <AlertCircleIcon className={styles.stepErrorIcon} aria-hidden />
                        <span>Please choose Refund, Replacement, or Exchange below.</span>
                      </div>
                    )}
                    <div role="radiogroup" aria-label="Preferred resolution" className={styles.resolutionThreeGrid}>
                      {/* Card 1: Refund */}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={resolutionType === "refund"}
                        onClick={() => {
                          setUserPickedResolution(true)
                          setResolutionType("refund")
                          setExchangeKind("")
                        }}
                        className={cn(
                          styles.resolutionCardBtn,
                          resolutionType === "refund" && styles.resolutionCardActive
                        )}
                      >
                        <span className={styles.resIconBadge}>
                          <WalletIcon className={styles.resIcon} aria-hidden />
                        </span>
                        <span className={styles.resTextCol}>
                          <span className={styles.resHeaderLine}>
                            <span className={styles.resTitle}>Refund</span>
                            {estimate.length > 0 && (
                              <span className={styles.resAmountPill}>{formatPrice(refundEstimateTotal)}</span>
                            )}
                          </span>
                          <span className={styles.resHint}>
                            Get the returned item price refunded to your UPI / bank account after pickup
                          </span>
                        </span>
                      </button>

                      {/* Card 2: Replacement (Same Item) */}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={resolutionType === "exchange" && exchangeKind === "replacement"}
                        onClick={() => {
                          setUserPickedResolution(true)
                          setResolutionType("exchange")
                          setExchangeKind("replacement")
                          setStep2Attempted(false)
                        }}
                        className={cn(
                          styles.resolutionCardBtn,
                          resolutionType === "exchange" && exchangeKind === "replacement" && styles.resolutionCardActive
                        )}
                      >
                        <span className={styles.resIconBadge}>
                          <RefreshCwIcon className={styles.resIcon} aria-hidden />
                        </span>
                        <span className={styles.resTextCol}>
                          <span className={styles.resHeaderLine}>
                            <span className={styles.resTitle}>Replacement (Same Item)</span>
                            <span className={styles.resTagBadge}>Free dispatch</span>
                          </span>
                          <span className={styles.resHint}>
                            Get a fresh piece of the exact same product (same size &amp; colour). Old item is picked up first.
                          </span>
                        </span>
                      </button>

                      {/* Card 3: Exchange (Size / Colour / Variant) */}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={resolutionType === "exchange" && exchangeKind === "exchange"}
                        onClick={() => {
                          setUserPickedResolution(true)
                          setResolutionType("exchange")
                          setExchangeKind("exchange")
                          setStep2Attempted(false)
                          requestAnimationFrame(() => {
                            exchangePrefBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                          })
                        }}
                        className={cn(
                          styles.resolutionCardBtn,
                          resolutionType === "exchange" && exchangeKind === "exchange" && styles.resolutionCardActive
                        )}
                      >
                        <span className={styles.resIconBadge}>
                          <ArrowLeftRightIcon className={styles.resIcon} aria-hidden />
                        </span>
                        <span className={styles.resTextCol}>
                          <span className={styles.resHeaderLine}>
                            <span className={styles.resTitle}>Exchange (Different Size / Colour / Variant)</span>
                          </span>
                          <span className={styles.resHint}>
                            Swap for another size, colour, or variant of equal value after old item pickup &amp; check
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {resolutionType === "refund" && (
                    <>
                      {estimate.length > 0 && (
                        <div className={styles.estimateBox}>
                          <p className={styles.estimateRow}>
                            <span>Estimated refund amount</span>
                            <span className={styles.estimateAmount}>{formatPrice(refundEstimateTotal)}</span>
                          </p>
                          <p className={styles.estimateNote}>
                            Price of the items you return.
                            {kept.length > 0
                              ? ` Delivery and handling charges (${formatPrice(kept.reduce((n, c) => n + c.amount, 0))}) are non-refundable.`
                              : " Delivery and handling charges are non-refundable."}
                          </p>
                        </div>
                      )}

                      <div className={styles.refundDestSection}>
                        <p className={styles.refundDestHeading}>
                          <WalletIcon className={styles.pinSvg} aria-hidden /> Where should we send your refund?
                        </p>
                        <div className={styles.refundDestOptions} role="radiogroup" aria-label="Refund destination">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={refundMode === "original"}
                            onClick={() => setRefundMode("original")}
                            className={cn(
                              styles.pickupRadioCard,
                              refundMode === "original" && styles.pickupRadioCardSelected
                            )}
                          >
                            <span className={styles.radioCircle} aria-hidden>
                              {refundMode === "original" && <CheckIcon className={styles.checkTinySvg} />}
                            </span>
                            <span className={styles.radioContentCol}>
                              <span className={styles.radioHeaderRow}>
                                Original UPI account (matched via payment UTR)
                              </span>
                              <span className={styles.radioSubText}>
                                We trace your 12-digit UTR and send the refund back to the same UPI/bank account after pickup
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={refundMode === "upi"}
                            onClick={() => {
                              setRefundMode("upi")
                              requestAnimationFrame(() => {
                                refundUpiBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                              })
                            }}
                            className={cn(
                              styles.pickupRadioCard,
                              refundMode === "upi" && styles.pickupRadioCardSelected
                            )}
                          >
                            <span className={styles.radioCircle} aria-hidden>
                              {refundMode === "upi" && <CheckIcon className={styles.checkTinySvg} />}
                            </span>
                            <span className={styles.radioContentCol}>
                              <span className={styles.radioHeaderRow}>
                                Provide my UPI ID for faster refund
                              </span>
                              <span className={styles.radioSubText}>
                                Share your UPI ID (e.g. name@okaxis) so our team can transfer your refund directly
                              </span>
                            </span>
                          </button>
                        </div>
                        {refundMode === "upi" && (
                          <div ref={refundUpiBoxRef}>
                            <TextField
                              label="Your UPI ID for refund *"
                              kind="upiId"
                              fieldSize="md"
                              placeholder="e.g. yourname@okicici"
                              hint="Double-check your UPI ID so your refund reaches you without delay."
                              value={refundUpiId}
                              onChange={(e) => {
                                setRefundUpiId(e.target.value)
                                if (serverFieldErrors.refundUpiId) {
                                  setServerFieldErrors((prev) => ({ ...prev, refundUpiId: "" }))
                                }
                              }}
                              onBlur={() => markTouched("refundUpiId")}
                              error={
                                serverFieldErrors.refundUpiId ||
                                ((step2Attempted || touched.refundUpiId) ? refundUpiError : undefined)
                              }
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {resolutionType === "exchange" && exchangeKind === "replacement" && (
                    <div ref={exchangePrefBoxRef} className={styles.exchangeBox}>
                      <div className={styles.exchangePromiseBanner}>
                        <p className={styles.promiseHeading}>How same-item replacement works</p>
                        <ul className={styles.promiseList}>
                          <li>You will receive the <strong>exact same product</strong> (same size &amp; same colour/variant) at no extra cost.</li>
                          <li>Our courier will pick up your old/damaged item first.</li>
                          <li>Once received and checked, your fresh replacement is dispatched — replacement is complete upon delivery.</li>
                        </ul>
                      </div>
                      <TextField
                        label="Optional note for your replacement"
                        fieldSize="md"
                        maxLength={140}
                        placeholder="e.g. Lid was cracked, or missing stand (optional)"
                        value={exchangePreference}
                        onChange={(e) => {
                          setExchangePreference(e.target.value)
                          if (serverFieldErrors.exchangePreference) {
                            setServerFieldErrors((prev) => ({ ...prev, exchangePreference: "" }))
                          }
                        }}
                        error={serverFieldErrors.exchangePreference}
                      />
                    </div>
                  )}

                  {resolutionType === "exchange" && exchangeKind === "exchange" && (
                    <div ref={exchangePrefBoxRef} className={styles.exchangeBox}>
                      <div className={styles.exchangePromiseBanner}>
                        <p className={styles.promiseHeading}>How size / variant exchange works</p>
                        <ul className={styles.promiseList}>
                          <li>Tell us the size, colour, or variant you want instead.</li>
                          <li>Keep the current item unused with original tags/packaging for pickup.</li>
                          <li>After pickup &amp; quick quality check, we dispatch your new variant — exchange completes once delivered to you.</li>
                        </ul>
                      </div>
                      <div className={styles.variantChipsRow} role="group" aria-label="Quick exchange type">
                        {[
                          { label: "Different Size", prefix: "Size: " },
                          { label: "Different Colour", prefix: "Colour: " },
                          { label: "Different Variant", prefix: "Variant: " },
                        ].map((chip) => {
                          const active = exchangePreference.toLowerCase().startsWith(chip.prefix.toLowerCase())
                          return (
                            <button
                              key={chip.label}
                              type="button"
                              onClick={() => {
                                const stripped = exchangePreference.replace(/^(Size|Colour|Variant)\s*:\s*/i, "")
                                setExchangePreference(`${chip.prefix}${stripped}`)
                              }}
                              className={cn(styles.variantChipBtn, active && styles.variantChipBtnActive)}
                            >
                              {chip.label}
                            </button>
                          )
                        })}
                      </div>
                      <TextField
                        label="Which size, colour, or variant would you like? *"
                        required
                        fieldSize="md"
                        maxLength={180}
                        placeholder="e.g. Size M instead of S, or Terracotta finish"
                        value={exchangePreference}
                        onChange={(e) => {
                          setExchangePreference(e.target.value)
                          if (serverFieldErrors.exchangePreference) {
                            setServerFieldErrors((prev) => ({ ...prev, exchangePreference: "" }))
                          }
                        }}
                        onBlur={() => markTouched("exchangePreference")}
                        hint="We'll confirm stock and reserve your requested variant on approval."
                        error={
                          serverFieldErrors.exchangePreference ||
                          ((step2Attempted || touched.exchangePreference) && needsExchangePref
                            ? "Please enter the size, colour, or variant you want (at least 2 characters)"
                            : undefined)
                        }
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div ref={pickupBoxRef} className={styles.wizardStepStack}>
                  {/* Pickup address summary card (switches the modal screen to choose or add an address) */}
                  <div className={styles.pickupSummarySection}>
                    <div className={styles.pickupSummaryTop}>
                      <p className={styles.pickupSummaryHeading}>
                        <MapPinIcon className={styles.pinSvg} aria-hidden /> Pickup address
                      </p>
                      <div className={styles.pickupActionBtns}>
                        {pickupMode === "new" && (
                          <button
                            type="button"
                            onClick={() => {
                              setPickupSubmitted(false)
                              setDialogView("pickup-new")
                            }}
                            className={styles.editPickupBtn}
                          >
                            <PencilIcon className={styles.pencilSvg} aria-hidden /> Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPickupSubmitted(false)
                            setDialogView("pickup-list")
                          }}
                          className={styles.changePickupBtn}
                        >
                          Change / add address
                        </button>
                      </div>
                    </div>

                    <div className={styles.pickupSummaryInnerCard}>
                      {pickupMode === "saved" && chosenSavedAddress ? (
                        <>
                          <div className={styles.badgeFlexRow}>
                            <span className={styles.labelBadgeSecondary}>
                              {chosenSavedAddress.label}
                            </span>
                            <span className={styles.altPickupBadge}>
                              Alternate pickup address
                            </span>
                          </div>
                          <p className={styles.summaryPersonLine}>
                            {chosenSavedAddress.fullName} · +91 {chosenSavedAddress.phone}
                          </p>
                          <p className={styles.summaryAddressLine}>
                            {chosenSavedAddress.address}, {chosenSavedAddress.city} - {chosenSavedAddress.pincode}
                          </p>
                        </>
                      ) : pickupMode === "new" && !hasRawNewPickupError && pickupPhoneDigits && pickupState ? (
                        <>
                          <div className={styles.badgeFlexRow}>
                            <span className={styles.labelBadgeSecondary}>
                              {saveNewPickupAddress ? newAddressLabel : "New address"}
                            </span>
                            <span className={styles.altPickupBadge}>
                              Alternate pickup address
                            </span>
                          </div>
                          <p className={styles.summaryPersonLine}>
                            {pickupName.trim()} · +91 {pickupPhoneDigits}
                          </p>
                          <p className={styles.summaryAddressLine}>
                            {pickupAddressLine.trim()}, {joinCityState(pickupCity.trim(), pickupState)} - {pickupPincode.trim()}
                          </p>
                        </>
                      ) : (
                        <>
                          <span className={styles.labelBadgePrimary}>
                            Order delivery address
                          </span>
                          {orderDelivery ? (
                            <>
                              <p className={styles.summaryPersonLine}>
                                {orderDelivery.name} · +91 {orderDelivery.phone}
                              </p>
                              <p className={styles.summaryAddressLine}>
                                {orderDelivery.address}, {orderDelivery.city} - {orderDelivery.pincode}
                              </p>
                            </>
                          ) : (
                            <p className={styles.summaryFallbackLine}>
                              Pickup will be scheduled at the original delivery address on this order. Currently at a different location? Tap <strong className={styles.strongText}>Change / add address</strong> above.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Final Review Summary Card */}
                  <div className={styles.reviewSummaryCard}>
                    <div className={styles.reviewSummaryHeader}>
                      <p className={styles.reviewSummaryTitle}>Request summary</p>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className={styles.editStepLinkBtn}
                      >
                        Edit items / reason
                      </button>
                    </div>
                    <dl className={styles.reviewSummaryDl}>
                      <div className={styles.reviewSummaryRow}>
                        <dt className={styles.reviewSummaryTerm}>Items</dt>
                        <dd className={styles.reviewSummaryVal}>
                          {payload
                            .map((p) => {
                              const itemName = items.find((o) => o.productId === p.productId)?.name ?? "Item"
                              return `${p.quantity} × ${itemName}`
                            })
                            .join(", ")}
                        </dd>
                      </div>
                      <div className={styles.reviewSummaryRow}>
                        <dt className={styles.reviewSummaryTerm}>Reason</dt>
                        <dd className={styles.reviewSummaryVal}>
                          {reason}
                          {details.trim() ? ` — ${details.trim()}` : ""}
                        </dd>
                      </div>
                      <div className={styles.reviewSummaryRow}>
                        <dt className={styles.reviewSummaryTerm}>Resolution</dt>
                        <dd className={styles.reviewSummaryVal}>
                          {resolutionType === "refund"
                            ? `Refund (${formatPrice(refundEstimateTotal)}) · ${refundMode === "upi" && cleanRefundUpi ? `UPI: ${cleanRefundUpi}` : "Original UPI via UTR"}`
                            : exchangeKind === "replacement"
                              ? `Replacement (Same item, same size & colour)${cleanExchangePref ? ` · ${cleanExchangePref}` : ""}`
                              : `Exchange · ${cleanExchangePref}`}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {isGuest && (
                    <div ref={guestPhoneBoxRef}>
                      <TextField
                        label="Your full mobile number"
                        kind="phone"
                        leading="+91"
                        fieldSize="md"
                        hint="Confirm the whole number you ordered with to submit this request."
                        required
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          if (serverFieldErrors.phone) {
                            setServerFieldErrors((prev) => ({ ...prev, phone: "" }))
                          }
                        }}
                        onBlur={() => markTouched("guestPhone")}
                        error={
                          serverFieldErrors.phone ||
                          (isGuest && (step3Attempted || touched.guestPhone) && phoneMissing
                            ? (phoneError ?? "Enter your 10-digit mobile number")
                            : undefined)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
              </DialogBody>
              <DialogFooter>
                {step === 1 ? (
                  <>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtn}>
                      <XIcon className={styles.btnIcon} /> Cancel
                    </Button>
                    <Button type="button" onClick={goStep2} disabled={pending} className={styles.pillBtn}>
                      Continue <ArrowRightIcon className={styles.btnIcon} />
                    </Button>
                  </>
                ) : step === 2 ? (
                  <>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => { setStep2Attempted(false); setStep(1) }} className={styles.pillBtn}>
                      <ArrowLeftIcon className={styles.btnIcon} /> Back
                    </Button>
                    <Button type="button" onClick={goStep3} disabled={pending} className={styles.pillBtn}>
                      Continue to pickup <ArrowRightIcon className={styles.btnIcon} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" disabled={pending} onClick={() => { setStep3Attempted(false); setStep(2) }} className={styles.pillBtn}>
                      <ArrowLeftIcon className={styles.btnIcon} /> Back
                    </Button>
                    <Button type="button" onClick={submit} disabled={pending} className={styles.pillBtn}>
                      {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <SendIcon className={styles.btnIcon} />} {submitButtonLabel}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {win.until && (
        <span className={styles.windowStatusNote}>
          {win.days}-day return &amp; exchange window open until <strong className={styles.windowStrong}>{formatDate(win.until)}</strong>
        </span>
      )}
    </>
  )
}

/** The customer's return requests and where each one stands. A request can be withdrawn until it is reviewed. */
export function ReturnRequestsPanel({
  requests,
  orderCode,
  phoneLast4,
  onChanged,
  returns = [],
  refundedInFull = false,
}: {
  requests: ReturnRequest[]
  /** Goods already received back: shown in the same card, under the requests. */
  returns?: OrderReturn[]
  refundedInFull?: boolean
  orderCode: string
  phoneLast4?: string
  onChanged?: () => void | Promise<unknown>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [phone, setPhone] = useState("")
  const [withdrawSubmitted, setWithdrawSubmitted] = useState(false)
  const [withdrawPhoneTouched, setWithdrawPhoneTouched] = useState(false)
  const later = useToastAfter(pending)
  useBlockWhile(pending)
  if (requests.length === 0) return <ReturnsList returns={returns} audience="customer" refundedInFull={refundedInFull} />

  // Guests on /track pass phoneLast4 and must prove their full 10-digit mobile number to withdraw;
  // signed-in owners on /account/orders/[code] omit phoneLast4 and are recognised by their session.
  const isGuest = phoneLast4 !== undefined
  const phoneDigits = normalizeIndianPhone(phone)
  const phoneError =
    isGuest && phone.trim() && !phoneDigits
      ? "Enter your 10-digit mobile number"
      : isGuest && phoneDigits && !phoneDigits.endsWith(phoneLast4)
        ? "Doesn't match the number you looked up"
        : undefined
  const phoneMissing = isGuest && (!phoneDigits || Boolean(phoneError))

  const closeConfirm = () => {
    setConfirmId(null)
    setPhone("")
    setWithdrawSubmitted(false)
    setWithdrawPhoneTouched(false)
  }

  const activeRequest = requests.find((r) => r.id === confirmId)
  const activeIsExchange = activeRequest?.resolutionType === "exchange"

  const withdraw = (id: string) => {
    setWithdrawSubmitted(true)
    if (phoneMissing) return
    const targetReq = requests.find((r) => r.id === id)
    const isEx = targetReq?.resolutionType === "exchange"
    startTransition(async () => {
      const res = await withdrawReturnRequest({
        code: orderCode,
        phoneLast4,
        phone: isGuest ? phoneDigits ?? undefined : undefined,
        requestId: id,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (onChanged) {
        await onChanged()
      } else {
        router.refresh()
      }
      later(() => {
        closeConfirm()
        toast.success(isEx ? "Exchange request cancelled" : "Return request cancelled")
      })
    })
  }

  return (
    <section aria-label="Return requests" className={styles.requestsPanel}>
      <h3 className={styles.panelTitle}>
        <PackageOpenIcon className={styles.panelIcon} aria-hidden /> Returns
      </h3>
      {/* Newest stage first: goods received back above the requests. */}
      <ReturnsList bare returns={returns.toReversed()} audience="customer" refundedInFull={refundedInFull} />
      <h4 className={styles.panelSubheading}>Return requests</h4>
      <ul className={styles.requestsList}>
        {requests.toReversed().map((r) => {
          const meta = requestStatusMeta(r.status, "customer", r.resolutionType, r.exchangePreference, r.exchangeStatus)
          const isExchange = r.resolutionType === "exchange"
          const isReplacement = isExchange && /^replacement\s*:/i.test(r.exchangePreference ?? "")
          const cleanPref = (r.exchangePreference ?? "").replace(/^(Replacement|Exchange)\s*:\s*/i, "")
          const { details: cleanDetails, pickupAddress, refundUpiId } = splitReturnDetails(r.details)
          return (
            <li key={r.id} className={styles.requestCard}>
              <div className={styles.requestTopRow}>
                <div className={styles.requestBadgesGroup}>
                  <span className={cn(styles.statusPill, TONES[meta.tone])}>{meta.label}</span>
                  <span

                    className={cn(
                      styles.typePill,
                      isExchange
                        ? styles.typePillExchange
                        : styles.typePillRefund
                    )}
                  >
                    {isExchange ? (
                      <>
                        <ArrowLeftRightIcon className={styles.swapTinySvg} aria-hidden /> {isReplacement ? "Replacement" : "Exchange"}
                      </>
                    ) : (
                      "Refund"
                    )}
                  </span>
                </div>
                <span className={styles.requestTimestamp}>{formatDateTime(r.createdAt)}</span>
              </div>
              <ul className={styles.requestItemsUl}>
                {r.items.map((i) => (
                  <li key={i.productId}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              {isExchange && cleanPref && (
                <p className={styles.exchangePrefBox}>
                  <span className={styles.prefBold}>
                    {isReplacement ? "Replacement details: " : "Requested exchange: "}
                  </span>
                  {cleanPref}
                </p>
              )}
              <p className={styles.reasonLine}>
                Reason: {r.reason}
                {cleanDetails ? ` — ${cleanDetails}` : ""}
              </p>
              {pickupAddress && !isGuest && (
                <p className={styles.pickupLineBox}>
                  <MapPinIcon className={styles.pickupPinSvg} aria-hidden />
                  <span>
                    <span className={styles.pickupLabelStrong}>Pickup address: </span>
                    {pickupAddress}
                  </span>
                </p>
              )}
              {refundUpiId && !isGuest && (
                <p className={styles.pickupLineBox}>
                  <WalletIcon className={styles.pickupPinSvg} aria-hidden />
                  <span>
                    <span className={styles.pickupLabelStrong}>Refund UPI ID: </span>
                    {refundUpiId}
                  </span>
                </p>
              )}
              {r.adminNote && (
                <p className={styles.adminNoteBox}>
                  <span className={styles.adminNoteLabel}>{r.status === "rejected" ? "Why: " : "From the shop: "}</span>
                  {r.adminNote}
                </p>
              )}
              {r.status === "approved" && (
                <p className={styles.statusHelperText}>
                  {r.pickedUpAt
                    ? isExchange
                      ? isReplacement
                        ? "Returned item picked up. Once it reaches us and is checked, your fresh replacement (same size & colour) will be dispatched."
                        : "Returned item picked up. Once it reaches us and passes quality check, your new variant will be dispatched."
                      : "Pickup successful. Once the items reach us and are checked, your refund is processed."
                    : r.pickupDate
                      ? r.exchangeMode === "doorstep"
                        ? `Doorstep exchange expected by ${formatDate(r.pickupDate)}. Our partner will bring your new item and collect the original item together — keep it packed and ready.`
                        : `Expected pickup by ${formatDate(r.pickupDate)}. Keep the ${isExchange ? "item(s)" : "items"} packed and ready.`
                      : isExchange
                        ? isReplacement
                          ? "Send the returned item back as described above. Once checked, we'll dispatch your same-item replacement."
                          : "Send the returned item back as described above. Once checked, we'll dispatch your new variant."
                        : "Send the items back as described above. Once they reach us and are checked, your refund is processed."}
                </p>
              )}
              {r.status === "received" && isExchange && (
                <p className={styles.statusHelperText}>
                  {r.exchangeStatus === "delivered" || r.exchangeDeliveredAt
                    ? isReplacement
                      ? "Your replacement (same item, same size & colour) has been delivered — replacement complete!"
                      : "Your exchanged item has been delivered — exchange complete!"
                    : r.exchangeStatus === "dispatched" || r.exchangeShippedAt
                      ? `${isReplacement ? "Your fresh replacement" : "Your new variant"} is on the way!${r.exchangeTracking ? ` (${r.exchangeTracking})` : ""}`
                      : isReplacement
                        ? "We received your returned item and are preparing your fresh same-item replacement for dispatch."
                        : "We received your returned item and checked it. Your new variant is being prepared for dispatch."}
                </p>
              )}
              {r.status === "withdrawn" && (
                <p className={styles.statusHelperText}>
                  Cancelled on {formatDateTime(r.decidedAt ?? r.createdAt)}
                </p>
              )}
              {r.status === "requested" && (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirmId(r.id)} className={styles.withdrawBtn}>
                  {pending && <Loader2Icon className={styles.btnIconSpin} />}{" "}
                  {isExchange ? (isReplacement ? "Cancel replacement" : "Cancel exchange") : "Cancel return"}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && !pending && closeConfirm()}>
        <DialogContent className={styles.confirmModalSize}>
          <DialogHeader>
            <DialogTitle>{activeIsExchange ? "Cancel this exchange request?" : "Cancel this return request?"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription className={styles.confirmDescription}>
              We won&apos;t process this request further, and no pickup will take place. You can submit a new request while the return window is open.
            </DialogDescription>
            {isGuest && (
              <TextField
                label="Your full mobile number"
                kind="phone"
                leading="+91"
                hint="Confirm the whole number you ordered with to cancel this request."
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setWithdrawPhoneTouched(true)}
                error={
                  (withdrawSubmitted || withdrawPhoneTouched) && phoneMissing
                    ? (phoneError ?? "Enter your 10-digit mobile number")
                    : undefined
                }
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeConfirm} disabled={pending} className={styles.pillBtn}>
              <CheckIcon className={styles.btnIcon} /> Keep request
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={() => confirmId && withdraw(confirmId)} className={styles.pillBtn}>
              {pending ? <Loader2Icon className={styles.btnIconSpin} /> : <Undo2Icon className={styles.btnIcon} />}{" "}
              {activeIsExchange ? "Cancel exchange" : "Cancel return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

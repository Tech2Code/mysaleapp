"use client"

import { ArrowLeftIcon, ArrowLeftRightIcon, CheckIcon, Loader2Icon, MapPinIcon, PackageOpenIcon, PencilIcon, PlusIcon, SendIcon, Undo2Icon, WalletIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { usePincodeLookup } from "@/components/shared/use-pincode-lookup"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { listMyAddresses, saveAddress } from "@/features/addresses/actions"
import { ADDRESS_LABELS, type Address } from "@/features/addresses/types"
import { joinCityState, STATE_OPTIONS, type IndianState } from "@/features/location/states"
import { requestReturn, withdrawReturnRequest } from "@/features/orders/actions"
import { OTHER_DETAIL_MESSAGE, OTHER_DETAIL_MIN, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { EXCHANGE_REASONS, isOpenRequest, itemReturnWindow, REPLACEMENT_REASONS, RETURN_REASONS, requestStatusMeta, returnableQuantities, splitReturnDetails } from "@/features/orders/returns"
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

type Window = { open: boolean; until: string | null; days: number }

/**
 * "Request a return" for a delivered order. Shown only while the return window is open and something
 * is still returnable. After that it points to WhatsApp. The shop approves or rejects the request.
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
  /** Delivery + extra charges + promo discount of the order: shown in the refund estimate. */
  charges?: { shippingFee: number; extraFees: OrderFee[]; discountAmount?: number }
  /** Original delivery address of the order, shown as the default pickup address. */
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
  onDone?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [resolutionType, setResolutionType] = useState<ReturnResolutionType>("refund")
  const [exchangeKind, setExchangeKind] = useState<"" | "exchange" | "replacement">("")
  const [exchangePreference, setExchangePreference] = useState("")
  const [reason, setReason] = useState<string>("")
  const [details, setDetails] = useState("")
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
  const [submitted, setSubmitted] = useState(false)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const itemsListRef = useRef<HTMLUListElement>(null)
  const exchangeBoxRef = useRef<HTMLDivElement>(null)
  const nextFieldsRef = useRef<HTMLDivElement>(null)
  const pickupBoxRef = useRef<HTMLDivElement>(null)
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

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const allLines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

  const windowByProduct = useMemo(() => {
    const map = new Map<string, { until: Date | null; open: boolean; days: number }>()
    for (const i of allLines) {
      if (history.length > 0) {
        const itemWin = itemReturnWindow(history, i.returnWindowDays, win.days, clientNow)
        map.set(i.productId, { ...itemWin, open: win.open && itemWin.open })
      } else {
        const d = i.returnWindowDays == null ? win.days : Math.max(0, Math.trunc(Number(i.returnWindowDays)))
        map.set(i.productId, { until: win.until ? new Date(win.until) : null, open: d > 0 && win.open, days: d })
      }
    }
    return map
  }, [allLines, history, win.days, win.open, win.until, clientNow])

  const lines = useMemo(
    () => allLines.filter((i) => (windowByProduct.get(i.productId)?.open ?? win.open) && (windowByProduct.get(i.productId)?.days ?? win.days) > 0),
    [allLines, windowByProduct, win.open, win.days]
  )

  // Default the first returnable item to "1" when the customer hasn't edited quantities yet so single/multi-item orders are ready immediately.
  const qtyOf = (id: string) => {
    if (qty[id] !== undefined) return qty[id]
    if (lines.length === 1 || (Object.keys(qty).length === 0 && lines[0]?.productId === id)) return "1"
    return ""
  }

  if (status !== "delivered") return null
  if (requests.some(isOpenRequest) || allLines.length === 0) return null

  if (win.days <= 0) {
    return (
      <p data-ui="store/RequestReturn" className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
        {allLines.length === 1 ? "This item is non-returnable." : "Items in this order are non-returnable."} If something arrived damaged in transit,{" "}
        <a data-ui="store/RequestReturn/a-message-us-on-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
          message us on WhatsApp
        </a>
        .
      </p>
    )
  }

  if (!win.open || lines.length === 0) {
    return (
      <p data-ui="store/RequestReturn" className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
        The {win.days}-day return &amp; exchange window for this order has ended{win.until ? ` (${formatDate(win.until)})` : ""}. If something is wrong with your order,{" "}
        <a data-ui="store/RequestReturn/a-message-us-on-whatsapp-2" href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-foreground underline underline-offset-4">
          message us on WhatsApp
        </a>
        .
      </p>
    )
  }

  const payload = lines
    .map((i) => ({ productId: i.productId, quantity: Number(qtyOf(i.productId)) || 0 }))
    .filter((i) => i.quantity > 0)
  const estimate = refundLines(items, payload.map((p) => ({ ...p, name: items.find((o) => o.productId === p.productId)?.name ?? "" })))
  const rawEstimateTotal = estimate.reduce((n, l) => n + l.amount, 0)
  const estimateTotal =
    resolutionType === "exchange"
      ? rawEstimateTotal
      : netReturnRefund(items, payload, { discountAmount: charges?.discountAmount ?? 0 })
  const kept = charges ? notRefundedCharges(charges) : []
  const needsDetail = !reason || otherNeedsDetail(reason, details)
  const needsExchangeKind = resolutionType === "exchange" && !exchangeKind
  const cleanExchangePref = exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "").trim()
  const needsExchangePref = resolutionType === "exchange" && cleanExchangePref.length < 2
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

  const reasonOptions =
    resolutionType === "exchange"
      ? exchangeKind === "replacement"
        ? REPLACEMENT_REASONS
        : EXCHANGE_REASONS
      : RETURN_REASONS

  const submitButtonLabel =
    resolutionType === "refund"
      ? "Send return request"
      : exchangeKind === "replacement"
        ? "Send replacement request"
        : exchangeKind === "exchange"
          ? "Send exchange request"
          : "Proceed with exchange / replacement"

  const showLowerFields = resolutionType === "refund" || Boolean(exchangeKind)

  const submit = () => {
    setSubmitted(true)
    setServerFieldErrors({})
    if (payload.length === 0) {
      itemsListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      if (lines.length > 1) {
        toast.error("Please enter a quantity of at least 1 for the item(s) you want to return or exchange.")
      }
      return
    }
    if (tooMany) {
      itemsListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    if (needsExchangeKind) {
      exchangeBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    if (needsExchangePref || !reason || needsDetail || phoneMissing) {
      nextFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    if (hasNewPickupError || savedPickupMissing) {
      pickupBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    startTransition(async () => {
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
      const rawPref = exchangePreference.trim()
      const formattedPref =
        resolutionType === "exchange"
          ? exchangeKind === "replacement"
            ? rawPref.replace(/^(Replacement|Exchange):\s*/i, "")
              ? `Replacement: ${rawPref.replace(/^(Replacement|Exchange):\s*/i, "")}`
              : rawPref
            : rawPref.replace(/^(Replacement|Exchange):\s*/i, "")
              ? `Exchange: ${rawPref.replace(/^(Replacement|Exchange):\s*/i, "")}`
              : rawPref
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
      })
      if (!res.ok) {
        const nextFieldErrors: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) nextFieldErrors[k] = msgs[0]
        }
        setServerFieldErrors(nextFieldErrors)
        toast.error(res.error)
        return
      }
      const submittedKind = resolutionType === "exchange" ? (exchangeKind === "replacement" ? "replacement" : "exchange") : "refund"
      later(() => {
        setOpen(false)
        resetFormState()
        toast.success(
          submittedKind === "replacement"
            ? "Replacement request sent. We'll review it and update you here."
            : submittedKind === "exchange"
              ? "Exchange request sent. We'll review it and update you here."
              : "Return request sent. We'll review it and update you here."
        )
      })
      onDone?.()
      router.refresh()
    })
  }

  const resetFormState = () => {
    setQty({})
    setResolutionType("refund")
    setExchangeKind("")
    setExchangePreference("")
    setReason("")
    setDetails("")
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
    setSubmitted(false)
    setServerFieldErrors({})
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      resetFormState()
    } else {
      setPickupName(orderDelivery?.name ?? "")
      setPickupPhone(orderDelivery?.phone ?? "")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        data-ui="store/RequestReturn/DialogTrigger-inline-flex"
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-6 text-sm font-semibold transition-colors hover:bg-muted"
      >
        <Undo2Icon className="size-4 shrink-0" aria-hidden /> Request return or exchange
      </DialogTrigger>
      {win.until && (
        <span data-ui="store/RequestReturn/span" className="basis-full text-xs text-muted-foreground">
          {win.days}-day return &amp; exchange window open until <strong data-ui="store/RequestReturn/strong" className="font-medium text-foreground">{formatDate(win.until)}</strong>
        </span>
      )}
      <DialogContent data-ui="store/RequestReturn/DialogContent" mobileFullScreen className="sm:max-w-lg">
        {dialogView === "pickup-list" ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose pickup address</DialogTitle>
              <DialogDescription>
                Select where our courier should pick up the item(s) for {orderCode}, or add a new pickup address.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div
                data-ui="store/RequestReturn/div-pickup-address"
                role="radiogroup"
                aria-label="Pickup address"
                className="space-y-2.5"
              >
                {/* Option 1: Original order delivery address */}
                <button
                  data-ui="store/RequestReturn/button"
                  type="button"
                  role="radio"
                  aria-checked={pickupMode === "order"}
                  onClick={() => {
                    setPickupMode("order")
                    setDialogView("main")
                  }}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left text-xs transition-all",
                    pickupMode === "order" ? "border-primary bg-primary/4 ring-1 ring-primary/30" : "hover:bg-muted/60"
                  )}
                >
                  <span
                    data-ui="store/RequestReturn/span-2"
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                      pickupMode === "order" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                    )}
                    aria-hidden
                  >
                    {pickupMode === "order" && <CheckIcon className="size-2.5" />}
                  </span>
                  <span data-ui="store/RequestReturn/span-3" className="min-w-0 flex-1 space-y-1">
                    <span data-ui="store/RequestReturn/span-flex" className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                      <span data-ui="store/RequestReturn/span-4" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Order delivery address
                      </span>
                      {orderDelivery && <span data-ui="store/RequestReturn/span-5">{orderDelivery.name} · +91 {orderDelivery.phone}</span>}
                    </span>
                    {orderDelivery ? (
                      <span data-ui="store/RequestReturn/span-6" className="block text-muted-foreground">
                        {orderDelivery.address}, {orderDelivery.city} - {orderDelivery.pincode}
                      </span>
                    ) : (
                      <span data-ui="store/RequestReturn/span-7" className="block text-muted-foreground">
                        Same address where this order was delivered
                      </span>
                    )}
                  </span>
                </button>

                {/* Option 2: Saved addresses from customer's address book */}
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
                        data-ui="store/RequestReturn/button-2"
                        key={addr.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setPickupMode("saved")
                          setSelectedAddressId(addr.id)
                          setDialogView("main")
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left text-xs transition-all",
                          selected ? "border-primary bg-primary/4 ring-1 ring-primary/30" : "hover:bg-muted/60"
                        )}
                      >
                        <span
                          data-ui="store/RequestReturn/span-8"
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                            selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                          )}
                          aria-hidden
                        >
                          {selected && <CheckIcon className="size-2.5" />}
                        </span>
                        <span data-ui="store/RequestReturn/span-9" className="min-w-0 flex-1 space-y-1">
                          <span data-ui="store/RequestReturn/span-flex-2" className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                            <span data-ui="store/RequestReturn/span-10" className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {addr.label}
                            </span>
                            {addr.fullName} · +91 {addr.phone}
                          </span>
                          <span data-ui="store/RequestReturn/span-11" className="block text-muted-foreground">
                            {addr.address}, {addr.city} - {addr.pincode}
                          </span>
                        </span>
                      </button>
                    )
                  })}

                {/* Option 3: Custom address already entered in this session */}
                {!hasRawNewPickupError && pickupPhoneDigits && pickupState && (
                  <button
                    data-ui="store/RequestReturn/button-3"
                    type="button"
                    role="radio"
                    aria-checked={pickupMode === "new"}
                    onClick={() => {
                      setPickupMode("new")
                      setDialogView("main")
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl border bg-card p-3.5 text-left text-xs transition-all",
                      pickupMode === "new" ? "border-primary bg-primary/4 ring-1 ring-primary/30" : "hover:bg-muted/60"
                    )}
                  >
                    <span
                      data-ui="store/RequestReturn/span-12"
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
                        pickupMode === "new" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"
                      )}
                      aria-hidden
                    >
                      {pickupMode === "new" && <CheckIcon className="size-2.5" />}
                    </span>
                    <span data-ui="store/RequestReturn/span-13" className="min-w-0 flex-1 space-y-1">
                      <span data-ui="store/RequestReturn/span-flex-3" className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                        <span data-ui="store/RequestReturn/span-14" className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {saveNewPickupAddress ? newAddressLabel : "New address"}
                        </span>
                        {pickupName.trim()} · +91 {pickupPhoneDigits}
                      </span>
                      <span data-ui="store/RequestReturn/span-15" className="block text-muted-foreground">
                        {pickupAddressLine.trim()}, {joinCityState(pickupCity.trim(), pickupState)} - {pickupPincode.trim()}
                      </span>
                    </span>
                  </button>
                )}

                {/* Button to open Step 3: Add New Pickup Address inside the same modal */}
                <button
                  data-ui="store/RequestReturn/button-add-a-new-pickup-addre"
                  type="button"
                  onClick={() => {
                    setPickupSubmitted(false)
                    setDialogView("pickup-new")
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-3.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <PlusIcon className="size-4 shrink-0" aria-hidden />
                  Add a new pickup address
                </button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                data-ui="store/RequestReturn/Button-back-to-return-details"
                type="button"
                variant="outline"
                onClick={() => setDialogView("main")}
                className="gap-1.5 rounded-full"
              >
                <ArrowLeftIcon className="size-4" /> Back to return details
              </Button>
            </DialogFooter>
          </>
        ) : dialogView === "pickup-new" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add new pickup address</DialogTitle>
              <DialogDescription>
                Enter the address where our courier should collect the item(s) for {orderCode}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div data-ui="store/RequestReturn/div" className="space-y-2">
                <div data-ui="store/RequestReturn/div-grid" className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                  <TextField
                    label="Contact name *"
                    kind="personName"
                    fieldSize="md"
                    value={pickupName}
                    onChange={(e) => setPickupName(e.target.value)}
                    error={pickupSubmitted ? rawNewPickupErrors.name : undefined}
                  />
                  <TextField
                    label="Mobile number *"
                    kind="phone"
                    leading="+91"
                    fieldSize="md"
                    value={pickupPhone}
                    onChange={(e) => setPickupPhone(e.target.value)}
                    error={pickupSubmitted ? rawNewPickupErrors.phone : undefined}
                  />
                </div>
                <div data-ui="store/RequestReturn/div-grid-2" className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                  <TextField
                    label="Pincode *"
                    kind="pincode"
                    fieldSize="md"
                    value={pickupPincode}
                    onChange={(e) => setPickupPincode(e.target.value)}
                    hint={pickupArea.loading ? "Looking up pincode…" : undefined}
                    error={pickupSubmitted || pickupPincode.length === 6 ? rawNewPickupErrors.pincode : undefined}
                  />
                  <TextField
                    label="City / District *"
                    kind="city"
                    fieldSize="md"
                    value={pickupCity}
                    onChange={(e) => setPickupCity(e.target.value)}
                    error={pickupSubmitted ? rawNewPickupErrors.city : undefined}
                  />
                </div>
                <SelectField
                  label="State *"
                  placeholder="Select state"
                  fieldSize="md"
                  value={pickupState}
                  onValueChange={(val) => setPickupState(val as IndianState)}
                  options={STATE_OPTIONS}
                  error={pickupSubmitted ? rawNewPickupErrors.state : undefined}
                />
                <TextAreaField
                  label="Full pickup address *"
                  rows={2}
                  maxLength={120}
                  placeholder="House / flat no., building, street, area & landmark"
                  value={pickupAddressLine}
                  onChange={(e) => setPickupAddressLine(e.target.value)}
                  error={pickupSubmitted ? rawNewPickupErrors.address : undefined}
                />
                {!isGuest && savedAddresses.length < 10 && (
                  <div data-ui="store/RequestReturn/div-2" className="space-y-2 rounded-xl border bg-muted/30 p-3">
                    <label data-ui="store/RequestReturn/label-save-this-address-to-m" className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                      <input
                        data-ui="store/RequestReturn/input-checkbox"
                        type="checkbox"
                        checked={saveNewPickupAddress}
                        onChange={(e) => setSaveNewPickupAddress(e.target.checked)}
                        className="size-4 rounded border-border accent-primary"
                      />
                      Save this address to my address book
                    </label>
                    {saveNewPickupAddress && (
                      <div data-ui="store/RequestReturn/div-flex" className="flex flex-wrap items-center gap-1.5 pl-6">
                        {ADDRESS_LABELS.map((lbl) => (
                          <button
                            data-ui="store/RequestReturn/button-4"
                            key={lbl}
                            type="button"
                            onClick={() => setNewAddressLabel(lbl)}
                            className={cn(
                              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                              newAddressLabel === lbl
                                ? "border-primary bg-primary text-primary-foreground"
                                : "bg-background text-muted-foreground hover:text-foreground"
                            )}
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
            <DialogFooter className="sm:justify-between">
              <Button
                data-ui="store/RequestReturn/Button-back"
                type="button"
                variant="outline"
                onClick={() => {
                  setPickupSubmitted(false)
                  setDialogView("pickup-list")
                }}
                className="gap-1.5 rounded-full"
              >
                <ArrowLeftIcon className="size-4" /> Back
              </Button>
              <Button
                data-ui="store/RequestReturn/Button-use-this-address"
                type="button"
                onClick={() => {
                  setPickupSubmitted(true)
                  if (hasRawNewPickupError) return
                  setPickupMode("new")
                  setPickupSubmitted(false)
                  setDialogView("main")
                }}
                className="gap-1.5 rounded-full"
              >
                <CheckIcon className="size-4" /> Use this address
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Return or exchange items from {orderCode}</DialogTitle>
              <DialogDescription>
                Choose what you want to send back and whether you want a refund or an exchange/replacement.
                {win.until ? ` You can request a return or exchange until ${formatDate(win.until)}.` : ""}
              </DialogDescription>
            </DialogHeader>

            <DialogBody>
              <ul ref={itemsListRef} data-ui="store/RequestReturn/ul" className="space-y-3">
            {allLines.map((i) => {
              const max = left.get(i.productId) ?? 0
              const itemWin = windowByProduct.get(i.productId)
              const eligible = (itemWin?.open ?? win.open) && (itemWin?.days ?? win.days) > 0
              return (
                <li
                  data-ui="store/RequestReturn/li"
                  key={i.productId}
                  className={cn(
                    "grid items-start gap-x-4 gap-y-1 rounded-xl border p-3 sm:grid-cols-[1fr_7rem]",
                    !eligible && "bg-muted/40 opacity-75"
                  )}
                >
                  <div data-ui="store/RequestReturn/div-3" className="space-y-0.5 sm:pt-1">
                    <p data-ui="store/RequestReturn/p" className="text-sm font-medium">{i.name}</p>
                    <p data-ui="store/RequestReturn/p-2" className="text-xs text-muted-foreground">
                      {itemWin && itemWin.days <= 0
                        ? "Non-returnable item"
                        : itemWin && !itemWin.open
                          ? `${itemWin.days}-day return window ended${itemWin.until ? ` (${formatDate(itemWin.until)})` : ""}`
                          : itemWin
                            ? `${itemWin.days}-day return & exchange window${itemWin.until ? ` · until ${formatDate(itemWin.until)}` : ""}`
                            : `${win.days}-day return & exchange window`}
                    </p>
                  </div>
                  {eligible ? (
                    <TextField
                      label={`Qty (max ${max})`}
                      kind="digits"
                      fieldSize="md"
                      inputMode="numeric"
                      maxLength={String(LIMITS.returnQuantity.max).length}
                      placeholder="0"
                      value={qtyOf(i.productId)}
                      onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                      error={
                        Number(qtyOf(i.productId)) > max
                          ? `At most ${max}`
                          : submitted && payload.length === 0 && i.productId === lines[0]?.productId
                            ? "Enter at least 1"
                            : undefined
                      }
                    />
                  ) : (
                    <span data-ui="store/RequestReturn/span-inline-flex" className="inline-flex items-center self-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:justify-self-end">
                      {(itemWin?.days ?? 0) <= 0 ? "Non-returnable" : "Window ended"}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          <div data-ui="store/RequestReturn/div-4" className="space-y-2">
            <p data-ui="store/RequestReturn/p-3" className="text-sm font-medium text-foreground">
              What would you prefer? *
            </p>
            <div data-ui="store/RequestReturn/div-grid-3" className="grid gap-2.5 sm:grid-cols-2">
              <button
                data-ui="store/RequestReturn/button-5"
                type="button"
                aria-pressed={resolutionType === "refund"}
                onClick={() => {
                  setResolutionType("refund")
                  if (reason && !(RETURN_REASONS as readonly string[]).includes(reason)) setReason("")
                }}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                  resolutionType === "refund"
                    ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <WalletIcon className={cn("mt-0.5 size-4 shrink-0", resolutionType === "refund" ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span data-ui="store/RequestReturn/span-16" className="space-y-0.5">
                  <span data-ui="store/RequestReturn/span-17" className="block text-sm font-semibold">
                    Refund
                  </span>
                  <span data-ui="store/RequestReturn/span-18" className="block text-xs text-muted-foreground">
                    Get the item price refunded after pickup
                  </span>
                </span>
              </button>
              <button
                data-ui="store/RequestReturn/button-6"
                type="button"
                aria-pressed={resolutionType === "exchange"}
                onClick={() => {
                  setResolutionType("exchange")
                  const targetReasons = exchangeKind === "replacement" ? REPLACEMENT_REASONS : EXCHANGE_REASONS
                  if (reason && !(targetReasons as readonly string[]).includes(reason)) setReason("")
                  requestAnimationFrame(() => {
                    exchangeBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                  })
                }}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                  resolutionType === "exchange"
                    ? "border-primary bg-primary/8 ring-1 ring-primary/30"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <ArrowLeftRightIcon className={cn("mt-0.5 size-4 shrink-0", resolutionType === "exchange" ? "text-primary" : "text-muted-foreground")} aria-hidden />
                <span data-ui="store/RequestReturn/span-19" className="space-y-0.5">
                  <span data-ui="store/RequestReturn/span-20" className="block text-sm font-semibold">
                    Exchange / Replacement
                  </span>
                  <span data-ui="store/RequestReturn/span-21" className="block text-xs text-muted-foreground">
                    Swap for another size, colour, or piece
                  </span>
                </span>
              </button>
            </div>
          </div>

          {resolutionType === "exchange" && (
            <div ref={exchangeBoxRef} data-ui="store/RequestReturn/div-5" className="space-y-3 rounded-xl border bg-muted/30 p-3.5">
              <SelectField
                label="Would you like an exchange or a replacement? *"
                placeholder="Choose Exchange or Replacement"
                fieldSize="md"
                value={exchangeKind}
                onValueChange={(val) => {
                  const nextKind = val as "" | "exchange" | "replacement"
                  setExchangeKind(nextKind)
                  const nextReasons = nextKind === "replacement" ? REPLACEMENT_REASONS : EXCHANGE_REASONS
                  if (reason && !(nextReasons as readonly string[]).includes(reason)) setReason("")
                  if (nextKind) {
                    requestAnimationFrame(() => {
                      nextFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                    })
                  }
                }}
                options={[
                  { value: "exchange", label: "Exchange — swap for another size, colour, or piece" },
                  { value: "replacement", label: "Replacement — get a fresh piece of the same item" },
                ]}
                error={submitted && needsExchangeKind ? "Please select Exchange or Replacement" : undefined}
              />

              {exchangeKind === "exchange" && (
                <TextField
                  label="Which size, colour, or piece would you like in exchange?"
                  required
                  fieldSize="md"
                  maxLength={180}
                  placeholder="e.g. Size M instead of S, or Terracotta colour"
                  value={exchangePreference}
                  onChange={(e) => {
                    setExchangePreference(e.target.value)
                    if (serverFieldErrors.exchangePreference) {
                      setServerFieldErrors((prev) => ({ ...prev, exchangePreference: "" }))
                    }
                  }}
                  hint="Specify the preferred size, colour, variant, or piece you want in exchange."
                  error={
                    serverFieldErrors.exchangePreference ||
                    ((submitted || exchangePreference.length > 0) && needsExchangePref
                      ? "Please enter what you would like in exchange (at least 2 characters)"
                      : undefined)
                  }
                />
              )}

              {exchangeKind === "replacement" && (
                <TextField
                  label="What should we check for your replacement piece?"
                  required
                  fieldSize="md"
                  maxLength={180}
                  placeholder="e.g. Send a fresh undamaged piece of the same item"
                  value={exchangePreference}
                  onChange={(e) => {
                    setExchangePreference(e.target.value)
                    if (serverFieldErrors.exchangePreference) {
                      setServerFieldErrors((prev) => ({ ...prev, exchangePreference: "" }))
                    }
                  }}
                  hint="We will dispatch a brand-new replacement of the exact same item after pickup."
                  error={
                    serverFieldErrors.exchangePreference ||
                    ((submitted || exchangePreference.length > 0) && needsExchangePref
                      ? "Please enter a short note for your replacement item (at least 2 characters)"
                      : undefined)
                  }
                />
              )}
            </div>
          )}

          {showLowerFields && (
            <div ref={nextFieldsRef} data-ui="store/RequestReturn/div-6" className="space-y-4">
              {estimate.length > 0 && (
                <div data-ui="store/RequestReturn/div-7" className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
                  <p data-ui="store/RequestReturn/p-flex" className="flex items-baseline justify-between gap-3 font-semibold">
                    <span data-ui="store/RequestReturn/span-22">
                      {resolutionType === "exchange"
                        ? exchangeKind === "replacement"
                          ? "Replacement item value"
                          : "Exchange item value"
                        : "You will get back"}
                    </span>
                    <span data-ui="store/RequestReturn/span-23">{formatPrice(estimateTotal)}</span>
                  </p>
                  <p data-ui="store/RequestReturn/p-4" className="text-xs text-muted-foreground">
                    {resolutionType === "exchange"
                      ? exchangeKind === "replacement"
                        ? "Once your returned item(s) are picked up and checked, we will dispatch a fresh replacement piece at no extra cost."
                        : "Once your returned item(s) are picked up and checked, we will dispatch your requested exchange item at no extra item cost."
                      : `Price of the items you return.${kept.length > 0 ? ` Delivery and other charges (${formatPrice(kept.reduce((n, c) => n + c.amount, 0))}) are not refunded.` : " Delivery and other charges are not refunded."}`}
                  </p>
                </div>
              )}
              <SelectField
                label={
                  resolutionType === "exchange"
                    ? exchangeKind === "replacement"
                      ? "Why do you need a replacement? *"
                      : "Why are you exchanging it? *"
                    : "Why are you returning it? *"
                }
                placeholder="Select a reason"
                fieldSize="md"
                value={reason}
                onValueChange={(val) => {
                  setReason(val)
                  if (serverFieldErrors.reason) {
                    setServerFieldErrors((prev) => ({ ...prev, reason: "" }))
                  }
                }}
                options={reasonOptions.map((r) => ({ value: r, label: r }))}
                error={
                  serverFieldErrors.reason ||
                  (submitted && !reason
                    ? resolutionType === "exchange"
                      ? exchangeKind === "replacement"
                        ? "Please select why you need a replacement"
                        : "Please select why you are exchanging this item"
                      : "Please select why you are returning this item"
                    : undefined)
                }
              />
              <TextAreaField
                label={reason === OTHER_REASON ? "Please tell us the reason" : "Additional details (optional)"}
                required={reason === OTHER_REASON}
                rows={2}
                maxLength={pickupMode === "order" ? LIMITS.returnDetail.max : 140}
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value)
                  if (serverFieldErrors.details) {
                    setServerFieldErrors((prev) => ({ ...prev, details: "" }))
                  }
                }}
                hint={reason === OTHER_REASON ? "Tell us the reason (at least 5 characters)." : "Add any extra details that help us handle your request faster."}
                error={
                  serverFieldErrors.details ||
                  ((submitted || details.trim().length > 0) && reason === OTHER_REASON && details.trim().length < OTHER_DETAIL_MIN
                    ? OTHER_DETAIL_MESSAGE
                    : undefined)
                }
              />

              {/* Pickup address summary card (switches the modal screen to choose or add an address) */}
              <div ref={pickupBoxRef} data-ui="store/RequestReturn/div-8" className="space-y-2.5 rounded-2xl border bg-muted/25 p-3.5">
                <div data-ui="store/RequestReturn/div-flex-2" className="flex flex-wrap items-center justify-between gap-2">
                  <p data-ui="store/RequestReturn/p-flex-2" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <MapPinIcon className="size-4 text-primary" aria-hidden /> Pickup address
                  </p>
                  <div data-ui="store/RequestReturn/div-flex-3" className="flex items-center gap-2">
                    {pickupMode === "new" && (
                      <button
                        data-ui="store/RequestReturn/button-edit"
                        type="button"
                        onClick={() => {
                          setPickupSubmitted(false)
                          setDialogView("pickup-new")
                        }}
                        className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                      >
                        <PencilIcon className="size-3" aria-hidden /> Edit
                      </button>
                    )}
                    <button
                      data-ui="store/RequestReturn/button-change-add-address"
                      type="button"
                      onClick={() => {
                        setPickupSubmitted(false)
                        setDialogView("pickup-list")
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                    >
                      Change / add address
                    </button>
                  </div>
                </div>

                <div data-ui="store/RequestReturn/div-9" className="rounded-xl border bg-card p-3 text-xs">
                  {pickupMode === "saved" && chosenSavedAddress ? (
                    <>
                      <div data-ui="store/RequestReturn/div-flex-4" className="flex flex-wrap items-center gap-1.5">
                        <span data-ui="store/RequestReturn/span-24" className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {chosenSavedAddress.label}
                        </span>
                        <span data-ui="store/RequestReturn/span-25" className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                          Alternate pickup address
                        </span>
                      </div>
                      <p data-ui="store/RequestReturn/p-5" className="mt-1.5 font-semibold text-foreground">
                        {chosenSavedAddress.fullName} · +91 {chosenSavedAddress.phone}
                      </p>
                      <p data-ui="store/RequestReturn/p-6" className="mt-0.5 text-muted-foreground">
                        {chosenSavedAddress.address}, {chosenSavedAddress.city} - {chosenSavedAddress.pincode}
                      </p>
                    </>
                  ) : pickupMode === "new" && !hasRawNewPickupError && pickupPhoneDigits && pickupState ? (
                    <>
                      <div data-ui="store/RequestReturn/div-flex-5" className="flex flex-wrap items-center gap-1.5">
                        <span data-ui="store/RequestReturn/span-26" className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {saveNewPickupAddress ? newAddressLabel : "New address"}
                        </span>
                        <span data-ui="store/RequestReturn/span-27" className="rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                          Alternate pickup address
                        </span>
                      </div>
                      <p data-ui="store/RequestReturn/p-7" className="mt-1.5 font-semibold text-foreground">
                        {pickupName.trim()} · +91 {pickupPhoneDigits}
                      </p>
                      <p data-ui="store/RequestReturn/p-8" className="mt-0.5 text-muted-foreground">
                        {pickupAddressLine.trim()}, {joinCityState(pickupCity.trim(), pickupState)} - {pickupPincode.trim()}
                      </p>
                    </>
                  ) : (
                    <>
                      <span data-ui="store/RequestReturn/span-28" className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        Order delivery address
                      </span>
                      {orderDelivery ? (
                        <>
                          <p data-ui="store/RequestReturn/p-9" className="mt-1.5 font-semibold text-foreground">
                            {orderDelivery.name} · +91 {orderDelivery.phone}
                          </p>
                          <p data-ui="store/RequestReturn/p-10" className="mt-0.5 text-muted-foreground">
                            {orderDelivery.address}, {orderDelivery.city} - {orderDelivery.pincode}
                          </p>
                        </>
                      ) : (
                        <p data-ui="store/RequestReturn/p-11" className="mt-1.5 text-muted-foreground">
                          Pickup will be scheduled at the original delivery address on this order. Currently at a different location? Tap <strong data-ui="store/RequestReturn/strong-2" className="font-medium text-foreground">Change / add address</strong> above.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isGuest && (
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
                  error={
                    serverFieldErrors.phone ||
                    (isGuest && (submitted || phone.trim().length > 0) && phoneMissing
                      ? (phoneError ?? "Enter your 10-digit mobile number")
                      : undefined)
                  }
                />
              )}
            </div>
          )}
            </DialogBody>
            <DialogFooter>
              <Button data-ui="store/RequestReturn/Button-close" type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className="gap-1.5 rounded-full">
                <XIcon className="size-4" /> Close
              </Button>
              <Button data-ui="store/RequestReturn/Button" type="button" onClick={submit} disabled={pending} className="gap-1.5 rounded-full">
                {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon className="size-4" />} {submitButtonLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
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
  onChanged?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [phone, setPhone] = useState("")
  const [withdrawSubmitted, setWithdrawSubmitted] = useState(false)
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
      later(() => {
        closeConfirm()
        toast.success(isEx ? "Exchange request cancelled" : "Return request cancelled")
      })
      onChanged?.()
      router.refresh()
    })
  }

  return (
    <section data-ui="store/ReturnRequestsPanel" aria-label="Return requests" className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h3 data-ui="store/ReturnRequestsPanel/h3-returns" className="flex items-center gap-2 font-sans text-base font-semibold">
        <PackageOpenIcon className="size-4 text-primary" aria-hidden /> Returns
      </h3>
      {/* Newest stage first: goods received back above the requests. */}
      <ReturnsList bare returns={returns.toReversed()} audience="customer" refundedInFull={refundedInFull} />
      <h4 data-ui="store/ReturnRequestsPanel/h4-return-requests" className="text-sm font-semibold text-muted-foreground">Return requests</h4>
      <ul data-ui="store/ReturnRequestsPanel/ul" className="space-y-3">
        {requests.toReversed().map((r) => {
          const meta = requestStatusMeta(r.status, "customer", r.resolutionType)
          const isExchange = r.resolutionType === "exchange"
          const isReplacement = isExchange && /^replacement\s*:/i.test(r.exchangePreference ?? "")
          const cleanPref = (r.exchangePreference ?? "").replace(/^(Replacement|Exchange)\s*:\s*/i, "")
          const { details: cleanDetails, pickupAddress } = splitReturnDetails(r.details)
          return (
            <li data-ui="store/ReturnRequestsPanel/li" key={r.id} className="space-y-2 rounded-xl border p-3.5">
              <div data-ui="store/ReturnRequestsPanel/div-flex" className="flex flex-wrap items-center justify-between gap-2">
                <div data-ui="store/ReturnRequestsPanel/div-flex-2" className="flex flex-wrap items-center gap-1.5">
                  <span data-ui="store/ReturnRequestsPanel/span" className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", TONES[meta.tone])}>{meta.label}</span>
                  <span
                    data-ui="store/ReturnRequestsPanel/span-2"
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      isExchange
                        ? "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isExchange ? (
                      <>
                        <ArrowLeftRightIcon className="size-3" aria-hidden /> {isReplacement ? "Replacement" : "Exchange"}
                      </>
                    ) : (
                      "Refund"
                    )}
                  </span>
                </div>
                <span data-ui="store/ReturnRequestsPanel/span-3" className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
              <ul data-ui="store/ReturnRequestsPanel/ul-2" className="space-y-0.5 text-sm">
                {r.items.map((i) => (
                  <li data-ui="store/ReturnRequestsPanel/li-2" key={i.productId}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              {isExchange && cleanPref && (
                <p data-ui="store/ReturnRequestsPanel/p" className="rounded-lg border border-indigo-500/20 bg-indigo-500/8 px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200">
                  <span data-ui="store/ReturnRequestsPanel/span-4" className="font-semibold">
                    {isReplacement ? "Replacement details: " : "Requested exchange: "}
                  </span>
                  {cleanPref}
                </p>
              )}
              <p data-ui="store/ReturnRequestsPanel/p-2" className="text-sm text-muted-foreground">
                Reason: {r.reason}
                {cleanDetails ? ` — ${cleanDetails}` : ""}
              </p>
              {pickupAddress && !isGuest && (
                <p data-ui="store/ReturnRequestsPanel/p-flex" className="flex items-start gap-1.5 rounded-lg border bg-muted/35 px-3 py-2 text-xs text-foreground">
                  <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span data-ui="store/ReturnRequestsPanel/span-5">
                    <span data-ui="store/ReturnRequestsPanel/span-6" className="font-semibold">Pickup address: </span>
                    {pickupAddress}
                  </span>
                </p>
              )}
              {r.adminNote && (
                <p data-ui="store/ReturnRequestsPanel/p-3" className="rounded-lg bg-muted/60 p-3 text-sm">
                  <span data-ui="store/ReturnRequestsPanel/span-7" className="font-semibold">{r.status === "rejected" ? "Why: " : "From the shop: "}</span>
                  {r.adminNote}
                </p>
              )}
              {r.status === "approved" && (
                <p data-ui="store/ReturnRequestsPanel/p-4" className="text-xs text-muted-foreground">
                  {r.pickedUpAt
                    ? isExchange
                      ? "Pickup successful. Once the items reach us and are checked, your replacement is dispatched."
                      : "Pickup successful. Once the items reach us and are checked, your refund is processed."
                    : r.pickupDate
                      ? `Pickup scheduled for ${formatDate(r.pickupDate)}. Keep the items packed and ready.`
                      : isExchange
                        ? "Send the items back as described above. Once they reach us and are checked, your replacement is dispatched."
                        : "Send the items back as described above. Once they reach us and are checked, your refund is processed."}
                </p>
              )}
              {r.status === "withdrawn" && (
                <p data-ui="store/ReturnRequestsPanel/p-5" className="text-xs text-muted-foreground">
                  Cancelled on {formatDateTime(r.decidedAt ?? r.createdAt)}
                </p>
              )}
              {r.status === "requested" && (
                <Button data-ui="store/ReturnRequestsPanel/Button" type="button" variant="outline" size="sm" disabled={pending} onClick={() => setConfirmId(r.id)} className="rounded-full">
                  {pending && <Loader2Icon className="animate-spin" />}{" "}
                  {isExchange ? (isReplacement ? "Cancel replacement" : "Cancel exchange") : "Cancel return"}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      <Dialog open={confirmId !== null} onOpenChange={(o) => !o && !pending && closeConfirm()}>
        <DialogContent data-ui="store/ReturnRequestsPanel/DialogContent" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{activeIsExchange ? "Cancel this exchange request?" : "Cancel this return request?"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <DialogDescription className="text-sm/relaxed text-muted-foreground">
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
                error={
                  (withdrawSubmitted || Boolean(phone.trim())) && phoneMissing
                    ? (phoneError ?? "Enter your 10-digit mobile number")
                    : undefined
                }
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button data-ui="store/ReturnRequestsPanel/Button-keep-request" type="button" variant="outline" onClick={closeConfirm} disabled={pending} className="gap-1.5 rounded-full">
              <CheckIcon className="size-4" /> Keep request
            </Button>
            <Button data-ui="store/ReturnRequestsPanel/Button-2" type="button" variant="destructive" disabled={pending} onClick={() => confirmId && withdraw(confirmId)} className="gap-1.5 rounded-full">
              {pending ? <Loader2Icon className="animate-spin" /> : <Undo2Icon className="size-4" />}{" "}
              {activeIsExchange ? "Cancel exchange" : "Cancel return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

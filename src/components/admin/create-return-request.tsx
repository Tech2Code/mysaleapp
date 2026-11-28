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
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  Undo2Icon,
  WalletIcon,
  XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { TextAreaField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { ProductImage } from "@/components/store/product-image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createReturnRequestAsAdmin } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, OTHER_DETAIL_MIN, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { netReturnRefund } from "@/features/orders/refund"
import { returnableQuantities, returnLineKey } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, ReturnResolutionType } from "@/features/orders/types"
import { useToastAfter } from "@/hooks/use-toast-after"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS, PATTERNS } from "@/lib/validation"
import styles from "./admin-orders.module.css"

type WizardStep = 1 | 2 | 3

const WIZARD_STEPS: { step: WizardStep; label: string }[] = [
  { step: 1, label: "Items & Reason" },
  { step: 2, label: "Resolution" },
  { step: 3, label: "Review & Create" },
]

const ADMIN_REASONS: { label: string; sub: string; defaultChoice: "refund" | "replacement" | "exchange" }[] = [
  { label: "Damaged or broken", sub: "Customer received a cracked, chipped, or transit-damaged piece", defaultChoice: "replacement" },
  { label: "Wrong item received", sub: "Delivered piece differs from what the customer ordered", defaultChoice: "replacement" },
  { label: "Not as described", sub: "Size, colour, or details differ from the listing", defaultChoice: "refund" },
  { label: "Need a different size or dimensions", sub: "Customer wants to swap for another size or variant", defaultChoice: "exchange" },
  { label: "Prefer a different colour or finish", sub: "Customer wants another colour or design", defaultChoice: "exchange" },
  { label: "Quality isn't what I expected", sub: "Material or finish did not meet customer expectations", defaultChoice: "refund" },
  { label: "Changed my mind", sub: "Customer no longer needs this item", defaultChoice: "refund" },
  { label: OTHER_REASON, sub: "Another reason discussed over WhatsApp or phone", defaultChoice: "refund" },
]

/**
 * 3-step "Create return or exchange request" wizard for admin (mirrors the customer popup,
 * tailored for requests agreed outside the app over WhatsApp / phone). Return window is ignored.
 */
export function CreateReturnRequest({
  orderId,
  orderCode,
  items,
  returns,
  discountAmount = 0,
  paidAmount,
  refundedAmount = 0,
}: {
  orderId: string
  orderCode: string
  items: OrderItem[]
  returns: OrderReturn[]
  discountAmount?: number
  paidAmount?: number
  refundedAmount?: number
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
  const [refundUpiId, setRefundUpiId] = useState("")
  const [altPickupAddress, setAltPickupAddress] = useState("")
  const [step1Attempted, setStep1Attempted] = useState(false)
  const [step2Attempted, setStep2Attempted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const [errorShakeKey, setErrorShakeKey] = useState(0)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const itemsSectionRef = useRef<HTMLDivElement>(null)
  const reasonBoxRef = useRef<HTMLDivElement>(null)
  const detailsBoxRef = useRef<HTMLDivElement>(null)
  const resolutionBoxRef = useRef<HTMLDivElement>(null)
  const exchangePrefBoxRef = useRef<HTMLDivElement>(null)
  const refundUpiBoxRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const resetForm = useCallback(() => {
    setStep(1)
    setQty({})
    setResolutionType("refund")
    setExchangeKind("")
    setUserPickedResolution(false)
    setExchangePreference("")
    setReason("")
    setDetails("")
    setRefundUpiId("")
    setAltPickupAddress("")
    setStep1Attempted(false)
    setStep2Attempted(false)
    setTouched({})
    setServerFieldErrors({})
  }, [])

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => {
      const key = returnLineKey(i)
      return !seen.has(key) && seen.add(key) && (left.get(key) ?? 0) > 0
    })
  }, [items, left])

  const qtyOf = (key: string) => {
    if (qty[key] !== undefined) return qty[key]
    if (lines[0] && returnLineKey(lines[0]) === key) return "1"
    return ""
  }

  const payload = lines
    .map((i) => ({
      productId: i.productId,
      ...(i.variantId ? { variantId: i.variantId } : {}),
      name: i.name,
      quantity: Number(qtyOf(returnLineKey(i))) || 0,
    }))
    .filter((i) => i.quantity > 0)

  const tooMany = payload.some((p) => p.quantity > (left.get(returnLineKey(p)) ?? 0))
  const detailsMissing = !reason || otherNeedsDetail(reason, details)
  const exchangeKindMissing = resolutionType === "exchange" && !exchangeKind
  const cleanExchangePref = exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "").trim()
  const exchangePrefMissing = resolutionType === "exchange" && exchangeKind === "exchange" && cleanExchangePref.length < 2
  const cleanRefundUpi = refundUpiId.trim()
  const refundUpiError =
    resolutionType === "refund" && cleanRefundUpi && !PATTERNS.upiId.test(cleanRefundUpi)
      ? "Enter a valid UPI ID, like name@okaxis"
      : undefined

  const refundEstimateTotal = netReturnRefund(items, payload, {
    discountAmount,
    paidAmount,
    alreadyRefunded: refundedAmount,
    priorReturnedLines: returns.filter((r) => r.refunded).flatMap((r) => r.items),
  })

  const submitButtonLabel =
    resolutionType === "refund"
      ? "Create return request"
      : exchangeKind === "replacement"
        ? "Create replacement request"
        : "Create exchange request"

  const scrollAndFocus = (el: HTMLElement | null, focusInput = false) => {
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    if (focusInput) {
      setTimeout(() => {
        const input = el.querySelector<HTMLElement>("input, textarea")
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
    if (detailsMissing) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(detailsBoxRef.current ?? reasonBoxRef.current, true)
      return
    }
    if (!userPickedResolution) {
      const matched = ADMIN_REASONS.find((r) => r.label === reason)
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
    if (exchangeKindMissing) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(resolutionBoxRef.current)
      return
    }
    if (refundUpiError) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(refundUpiBoxRef.current ?? resolutionBoxRef.current, true)
      return
    }
    if (exchangePrefMissing) {
      setErrorShakeKey((k) => k + 1)
      scrollAndFocus(exchangePrefBoxRef.current ?? resolutionBoxRef.current, true)
      return
    }
    setStep2Attempted(false)
    setStep(3)
  }

  const submit = () => {
    setServerFieldErrors({})
    if (payload.length === 0 || tooMany || !reason || detailsMissing) {
      setErrorShakeKey((k) => k + 1)
      setStep1Attempted(true)
      setStep(1)
      return
    }
    if (exchangeKindMissing || exchangePrefMissing || refundUpiError) {
      setErrorShakeKey((k) => k + 1)
      setStep2Attempted(true)
      setStep(2)
      return
    }
    startTransition(async () => {
      const formattedPref =
        resolutionType === "exchange"
          ? exchangeKind === "replacement"
            ? cleanExchangePref
              ? `Replacement: Same item, same size & colour — ${cleanExchangePref}`
              : "Replacement: Same item, same size & colour"
            : `Exchange: ${cleanExchangePref}`
          : undefined
      const res = await createReturnRequestAsAdmin({
        orderId,
        items: payload,
        reason,
        details: details.trim() || undefined,
        pickupAddress: altPickupAddress.trim() || undefined,
        refundUpiId: resolutionType === "refund" && cleanRefundUpi ? cleanRefundUpi : undefined,
        resolutionType,
        exchangePreference: formattedPref,
      })
      if (!res.ok) {
        const nextFieldErrors: Record<string, string> = {}
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) nextFieldErrors[k] = msgs[0]
        }
        setServerFieldErrors(nextFieldErrors)
        if (nextFieldErrors.reason || nextFieldErrors.details || nextFieldErrors.items) {
          setStep(1)
        } else if (nextFieldErrors.exchangePreference) {
          setStep(2)
        }
        toast.error(res.error)
        return
      }
      later(() => {
        setOpen(false)
        resetForm()
        toast.success("Request created. Approve it from the status dropdown.")
      })
      router.refresh()
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  const handleBackStep = () => {
    if (pending) return true
    if (step > 1) {
      setStep((s) => (s - 1) as WizardStep)
      return true
    }
    return false
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} onBackStep={handleBackStep}>
      <DialogTrigger className={buttonVariants({ variant: "soft", fullWidth: true })}>
        <Undo2Icon className={styles.iconMd} aria-hidden /> Create return or exchange
      </DialogTrigger>
      <DialogContent mobileFullScreen className={styles.adminReturnDialog}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>
            {step === 1
              ? `Items & reason · ${orderCode}`
              : step === 2
                ? `Choose resolution · ${orderCode}`
                : `Review & create · ${orderCode}`}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "For requests agreed over WhatsApp or phone. Return window is bypassed."
              : step === 2
                ? "Select Refund, Replacement, or Exchange as agreed with the customer."
                : "Confirm the details below. You'll approve and schedule pickup next."}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.wizardStepperStrip}>
          <nav aria-label="Return creation progress" className={styles.wizardStepsBar}>
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
                <p className={styles.stepSectionTitle}>1. Select item(s) &amp; quantity *</p>
                {step1Attempted && payload.length === 0 && (
                  <div key={`items-err-${errorShakeKey}`} role="alert" className={styles.stepErrorBanner}>
                    <AlertCircleIcon className={styles.stepErrorIcon} aria-hidden />
                    <span>Please select at least 1 item to continue.</span>
                  </div>
                )}
                <ul className={cn(styles.wizardItemsList, step1Attempted && payload.length === 0 && styles.wizardItemsListError)}>
                  {lines.map((i) => {
                    const key = returnLineKey(i)
                    const max = left.get(key) ?? 0
                    const currentQty = Math.min(max, Math.max(0, Number(qtyOf(key)) || 0))
                    const isChecked = currentQty > 0
                    const setItemQty = (nextNum: number) => {
                      const clamped = Math.min(max, Math.max(0, nextNum))
                      setQty((q) => ({ ...q, [key]: clamped > 0 ? String(clamped) : "0" }))
                    }
                    const itemCheckId = `admin-return-item-${key}`
                    return (
                      <li key={key} className={cn(styles.wizardItemCard, isChecked && styles.wizardItemCardSelected)}>
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
                          <label htmlFor={itemCheckId} className={styles.itemInfoCol}>
                            <span className={styles.wizardItemName}>{i.name}</span>
                            <span className={styles.itemPriceMeta}>
                              {formatPrice(i.price)} each · Ordered: {i.quantity}
                            </span>
                          </label>
                        </div>
                        <div className={styles.itemControlsBottom}>
                          <span className={styles.itemQtyLabel}>
                            {isChecked ? `Selected ${currentQty} of ${max}` : `Max returnable: ${max}`}
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
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div ref={reasonBoxRef} className={styles.stepSectionBlock}>
                <p className={styles.stepSectionTitle}>2. Customer&apos;s reason *</p>
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
                  {ADMIN_REASONS.map((r) => {
                    const selected = reason === r.label
                    return (
                      <button
                        key={r.label}
                        type="button"
                        role="radio"
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
                      label={reason === OTHER_REASON ? "Details (required) *" : "Additional details (optional)"}
                      required={reason === OTHER_REASON}
                      rows={2}
                      maxLength={LIMITS.returnDetail.max}
                      placeholder={
                        reason === OTHER_REASON
                          ? "Describe what the customer reported (at least 5 characters)…"
                          : "Optional notes from your WhatsApp / phone conversation…"
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
            <div ref={resolutionBoxRef} className={styles.wizardStepStack}>
              <div className={styles.stepSectionBlock}>
                <p className={styles.stepSectionTitle}>Agreed resolution *</p>
                {step2Attempted && exchangeKindMissing && (
                  <div key={`res-err-${errorShakeKey}`} role="alert" className={styles.stepErrorBanner}>
                    <AlertCircleIcon className={styles.stepErrorIcon} aria-hidden />
                    <span>Please choose Refund, Replacement, or Exchange below.</span>
                  </div>
                )}
                <div role="radiogroup" aria-label="Resolution type" className={styles.resolutionThreeGrid}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={resolutionType === "refund"}
                    onClick={() => {
                      setUserPickedResolution(true)
                      setResolutionType("refund")
                      setExchangeKind("")
                    }}
                    className={cn(styles.resolutionCardBtn, resolutionType === "refund" && styles.resolutionCardActive)}
                  >
                    <span className={styles.resIconBadge}>
                      <WalletIcon className={styles.resIcon} aria-hidden />
                    </span>
                    <span className={styles.resTextCol}>
                      <span className={styles.resHeaderLine}>
                        <span className={styles.resTitle}>Refund</span>
                        {payload.length > 0 && (
                          <span className={styles.resAmountPill}>{formatPrice(refundEstimateTotal)}</span>
                        )}
                      </span>
                      <span className={styles.resHint}>
                        Collect returned item(s), inspect, and record refund to customer&apos;s UPI / bank account
                      </span>
                    </span>
                  </button>

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
                        Send a fresh piece of the exact same product (same size &amp; colour) — standard or doorstep swap
                      </span>
                    </span>
                  </button>

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
                        <span className={styles.resTitle}>Exchange (Size / Colour / Variant)</span>
                      </span>
                      <span className={styles.resHint}>
                        Swap for another size, colour, or variant of equal value — standard or doorstep swap
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              {resolutionType === "refund" && (
                <div ref={refundUpiBoxRef} className={styles.exchangeBox}>
                  {payload.length > 0 && (
                    <div className={styles.estimateBox}>
                      <p className={styles.estimateRow}>
                        <span>Estimated item refund</span>
                        <span className={styles.estimateAmount}>{formatPrice(refundEstimateTotal)}</span>
                      </p>
                      <p className={styles.estimateNote}>
                        You&apos;ll record the actual refund after the returned item(s) are received.
                      </p>
                    </div>
                  )}
                  <TextField
                    label="Customer refund UPI ID (optional)"
                    kind="upiId"
                    fieldSize="md"
                    placeholder="e.g. customer@okicici (leave blank to use original UTR)"
                    hint="Optional — if the customer shared a UPI ID on WhatsApp/phone for faster refund."
                    value={refundUpiId}
                    onChange={(e) => setRefundUpiId(e.target.value)}
                    onBlur={() => markTouched("refundUpiId")}
                    error={(step2Attempted || touched.refundUpiId) ? refundUpiError : undefined}
                  />
                </div>
              )}

              {resolutionType === "exchange" && exchangeKind === "replacement" && (
                <div ref={exchangePrefBoxRef} className={styles.exchangeBox}>
                  <TextField
                    label="Replacement note (optional)"
                    fieldSize="md"
                    maxLength={140}
                    placeholder="e.g. Lid was cracked, or missing stand (optional)"
                    hint="Replacement is always the exact same product (same size & colour)."
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
                    label="Requested exchange *"
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
                    error={
                      serverFieldErrors.exchangePreference ||
                      ((step2Attempted || touched.exchangePreference) && exchangePrefMissing
                        ? "Please enter the customer's exchange preference (at least 2 characters)"
                        : undefined)
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div className={styles.wizardStepStack}>
              <div className={styles.reviewSummaryCard}>
                <div className={styles.reviewSummaryHeader}>
                  <p className={styles.reviewSummaryTitle}>Request summary</p>
                  <div className={styles.reviewEditBtns}>
                    <button type="button" onClick={() => setStep(1)} className={styles.editStepLinkBtn}>
                      Edit items
                    </button>
                    <button type="button" onClick={() => setStep(2)} className={styles.editStepLinkBtn}>
                      Edit resolution
                    </button>
                  </div>
                </div>
                <dl className={styles.reviewSummaryDl}>
                  <div className={styles.reviewSummaryRow}>
                    <dt className={styles.reviewSummaryTerm}>Items</dt>
                    <dd className={styles.reviewSummaryVal}>
                      {payload.map((p) => `${p.quantity} × ${p.name}`).join(", ")}
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
                        ? `Refund (${formatPrice(refundEstimateTotal)})${cleanRefundUpi ? ` · UPI: ${cleanRefundUpi}` : " · Original UPI via UTR"}`
                        : exchangeKind === "replacement"
                          ? `Replacement (Same item, same size & colour)${cleanExchangePref ? ` · ${cleanExchangePref}` : ""}`
                          : `Exchange · ${cleanExchangePref}`}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className={styles.altPickupFieldCard}>
                <p className={styles.altPickupFieldTitle}>
                  <MapPinIcon className={styles.altPickupPinSvg} aria-hidden /> Pickup address (optional)
                </p>
                <TextAreaField
                  label="Alternate pickup address"
                  rows={2}
                  maxLength={160}
                  placeholder="Leave blank to use the order's delivery address"
                  value={altPickupAddress}
                  onChange={(e) => setAltPickupAddress(e.target.value)}
                />
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtnGap}>
                <XIcon className={styles.iconMd} /> Cancel
              </Button>
              <Button type="button" onClick={goStep2} disabled={pending} className={styles.pillBtnGap}>
                Continue <ArrowRightIcon className={styles.iconMd} />
              </Button>
            </>
          ) : step === 2 ? (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => { setStep2Attempted(false); setStep(1) }} className={styles.pillBtnGap}>
                <ArrowLeftIcon className={styles.iconMd} /> Back
              </Button>
              <Button type="button" onClick={goStep3} disabled={pending} className={styles.pillBtnGap}>
                Review request <ArrowRightIcon className={styles.iconMd} />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setStep(2)} className={styles.pillBtnGap}>
                <ArrowLeftIcon className={styles.iconMd} /> Back
              </Button>
              <Button type="button" onClick={submit} disabled={pending} className={styles.pillBtnGap}>
                {pending ? <Loader2Icon className={styles.spinIcon} /> : <SendIcon className={styles.iconMd} />} {submitButtonLabel}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

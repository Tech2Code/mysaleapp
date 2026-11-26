"use client"

import { Loader2Icon, SendIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { SelectField, TextAreaField, TextField } from "@/components/form"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createReturnRequestAsAdmin } from "@/features/orders/admin-actions"
import { OTHER_DETAIL_MESSAGE, OTHER_REASON, otherNeedsDetail } from "@/features/orders/reasons"
import { EXCHANGE_REASONS, REPLACEMENT_REASONS, RETURN_REASONS, returnableQuantities } from "@/features/orders/returns"
import type { OrderItem, OrderReturn, ReturnResolutionType } from "@/features/orders/types"
import { LIMITS } from "@/lib/validation"
import styles from "./admin-orders.module.css"

/**
 * "Create return request" for a customer who asked outside the app (WhatsApp / phone). It opens a normal request
 * (return window ignored); the admin then approves it from the same status dropdown.
 */
export function CreateReturnRequest({ orderId, orderCode, items, returns }: { orderId: string; orderCode: string; items: OrderItem[]; returns: OrderReturn[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [resolutionType, setResolutionType] = useState<ReturnResolutionType>("refund")
  const [exchangeKind, setExchangeKind] = useState<"" | "exchange" | "replacement">("")
  const [exchangePreference, setExchangePreference] = useState("")
  const [reason, setReason] = useState<string>("")
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (field: string) => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({})
  const itemsListRef = useRef<HTMLUListElement>(null)
  const exchangeBoxRef = useRef<HTMLDivElement>(null)
  const nextFieldsRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const left = useMemo(() => returnableQuantities(items, returns), [items, returns])
  const lines = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => !seen.has(i.productId) && seen.add(i.productId) && (left.get(i.productId) ?? 0) > 0)
  }, [items, left])

  const qtyOf = (id: string) => {
    if (qty[id] !== undefined) return qty[id]
    if (lines[0]?.productId === id) return "1"
    return ""
  }

  const payload = lines.map((i) => ({ productId: i.productId, name: i.name, quantity: Number(qtyOf(i.productId)) || 0 })).filter((i) => i.quantity > 0)
  const over = (id: string) => Number(qtyOf(id)) > (left.get(id) ?? 0)
  const detailsMissing = otherNeedsDetail(reason, details)
  const exchangeKindMissing = resolutionType === "exchange" && !exchangeKind
  const exchangePrefMissing =
    resolutionType === "exchange" &&
    exchangeKind === "exchange" &&
    exchangePreference.replace(/^(Replacement|Exchange)\s*:\s*/i, "").trim().length < 2
  const showLowerFields = resolutionType === "refund" || Boolean(exchangeKind)

  const reasonOptions =
    resolutionType === "exchange"
      ? exchangeKind === "replacement"
        ? REPLACEMENT_REASONS
        : EXCHANGE_REASONS
      : RETURN_REASONS

  const submitButtonLabel =
    resolutionType === "refund"
      ? "Create return request"
      : exchangeKind === "replacement"
        ? "Create replacement request"
        : exchangeKind === "exchange"
          ? "Create exchange request"
          : "Create request"

  const submit = () => {
    setSubmitted(true)
    setServerFieldErrors({})
    if (payload.length === 0) {
      itemsListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      if (lines.length > 1) {
        toast.error("Enter a quantity of at least 1.")
      }
      return
    }
    if (lines.some((i) => over(i.productId))) {
      itemsListRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    if (exchangeKindMissing) {
      exchangeBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    if (exchangePrefMissing || !reason || detailsMissing) {
      nextFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
      return
    }
    startTransition(async () => {
      const cleanPref = exchangePreference.trim().replace(/^(Replacement|Exchange):\s*/i, "")
      const formattedPref =
        resolutionType === "exchange"
          ? exchangeKind === "replacement"
            ? cleanPref
              ? `Replacement: Same item, same size & colour — ${cleanPref}`
              : "Replacement: Same item, same size & colour"
            : `Exchange: ${cleanPref}`
          : undefined
      const res = await createReturnRequestAsAdmin({
        orderId,
        items: payload,
        reason,
        details: details.trim() || undefined,
        resolutionType,
        exchangePreference: formattedPref,
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
      later(() => {
        setOpen(false)
        setQty({})
        setResolutionType("refund")
        setExchangeKind("")
        setExchangePreference("")
        setReason("")
        setDetails("")
        setSubmitted(false)
        setTouched({})
        setServerFieldErrors({})
        toast.success("Request created. Approve it from the status dropdown.")
      })
      router.refresh()
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setQty({})
      setResolutionType("refund")
      setExchangeKind("")
      setExchangePreference("")
      setReason("")
      setDetails("")
      setSubmitted(false)
      setTouched({})
      setServerFieldErrors({})
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className={styles.createReturnTrigger}>
        Create return request
      </DialogTrigger>
      <DialogContent mobileFullScreen className={styles.dialogLgMax}>
        <DialogHeader showCloseButton={!pending}>
          <DialogTitle>Return or exchange request for {orderCode}</DialogTitle>
          <DialogDescription>For a customer who asked outside the app. The return window is ignored. You approve it next, with a pickup date.</DialogDescription>
        </DialogHeader>
        <DialogBody className={styles.dialogBodyStack3}>
          <ul ref={itemsListRef} className={styles.returnItemsList}>
            {lines.map((i) => (
              <li key={i.productId} className={styles.returnItemCard}>
                <p className={styles.returnItemName}>{i.name}</p>
                <TextField
                  label={`How many (max ${left.get(i.productId) ?? 0})`}
                  kind="digits"
                  fieldSize="md"
                  inputMode="numeric"
                  maxLength={String(LIMITS.returnQuantity.max).length}
                  value={qtyOf(i.productId)}
                  onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                  error={
                    over(i.productId)
                      ? `At most ${left.get(i.productId) ?? 0}`
                      : submitted && payload.length === 0 && i.productId === lines[0]?.productId
                        ? "Enter at least 1"
                        : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <SelectField
            label="Resolution *"
            fieldSize="md"
            options={[
              { value: "refund", label: "Refund" },
              { value: "exchange", label: "Exchange / Replacement" },
            ]}
            value={resolutionType}
            onValueChange={(v) => {
              const nextRes = v as ReturnResolutionType
              setResolutionType(nextRes)
              const targetReasons =
                nextRes === "exchange"
                  ? exchangeKind === "replacement"
                    ? REPLACEMENT_REASONS
                    : EXCHANGE_REASONS
                  : RETURN_REASONS
              if (reason && !(targetReasons as readonly string[]).includes(reason)) setReason("")
              if (nextRes === "exchange") {
                requestAnimationFrame(() => {
                  exchangeBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                })
              }
            }}
          />
          {resolutionType === "exchange" && (
            <div ref={exchangeBoxRef} className={styles.exchangeBox}>
              <SelectField
                label="Exchange or Replacement? *"
                placeholder="Choose Exchange or Replacement"
                fieldSize="md"
                options={[
                  { value: "exchange", label: "Exchange — another size, colour, or piece" },
                  { value: "replacement", label: "Replacement — fresh piece of the same item" },
                ]}
                value={exchangeKind}
                onValueChange={(v) => {
                  const nextKind = v as "" | "exchange" | "replacement"
                  setExchangeKind(nextKind)
                  const nextReasons = nextKind === "replacement" ? REPLACEMENT_REASONS : EXCHANGE_REASONS
                  if (reason && !(nextReasons as readonly string[]).includes(reason)) setReason("")
                  if (nextKind) {
                    requestAnimationFrame(() => {
                      nextFieldsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                    })
                  }
                }}
                error={submitted && exchangeKindMissing ? "Please select Exchange or Replacement" : undefined}
              />
              {exchangeKind === "exchange" && (
                <TextField
                  label="Requested exchange *"
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
                  onBlur={() => markTouched("exchangePreference")}
                  error={
                    serverFieldErrors.exchangePreference ||
                    ((submitted || touched.exchangePreference) && exchangePrefMissing
                      ? "Please enter the customer's exchange preference (at least 2 characters)"
                      : undefined)
                  }
                />
              )}
              {exchangeKind === "replacement" && (
                <TextField
                  label="Replacement note (optional)"
                  fieldSize="md"
                  maxLength={140}
                  placeholder="e.g. Lid was cracked (optional)"
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
              )}
            </div>
          )}
          {showLowerFields && (
            <div ref={nextFieldsRef} className={styles.dialogBodyStack3}>
              <SelectField
                label={
                  resolutionType === "exchange"
                    ? exchangeKind === "replacement"
                      ? "Replacement reason *"
                      : "Exchange reason *"
                    : "Return reason *"
                }
                placeholder="Select a reason"
                fieldSize="md"
                options={reasonOptions.map((r) => ({ value: r, label: r }))}
                value={reason}
                onValueChange={(val) => {
                  setReason(val)
                  if (serverFieldErrors.reason) {
                    setServerFieldErrors((prev) => ({ ...prev, reason: "" }))
                  }
                }}
                error={serverFieldErrors.reason || (submitted && !reason ? "Please select a reason" : undefined)}
              />
              <TextAreaField
                label={reason === OTHER_REASON ? "Details (required)" : "Details (optional)"}
                required={reason === OTHER_REASON}
                rows={2}
                maxLength={LIMITS.returnDetail.max}
                placeholder="Describe why the customer is returning or exchanging the item(s)"
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
                  ((submitted || touched.details) && detailsMissing ? OTHER_DETAIL_MESSAGE : undefined)
                }
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)} className={styles.pillBtnGap}>
            <XIcon className={styles.iconMd} /> Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending} className={styles.pillBtnGap}>
            {pending ? <Loader2Icon className={styles.spinIcon} /> : <SendIcon className={styles.iconMd} />} {submitButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

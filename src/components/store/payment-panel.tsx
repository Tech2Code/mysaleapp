"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  AlertCircleIcon,
  BadgeCheckIcon,
  ClockIcon,
  CopyIcon,
  HourglassIcon,
  Loader2Icon,
  QrCodeIcon,
  SmartphoneIcon,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { submitPayment } from "@/features/orders/actions"
import { CopyableReference } from "@/components/shared/copyable-reference"
import { paymentReferenceSchema } from "@/features/orders/schema"
import { buildUpiUrl } from "@/features/orders/upi"
import {
  PAYMENT_METHOD_LABEL,
  type OrderPayment,
  type OrderStatus,
} from "@/features/orders/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatDateTime, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { WhatsAppIcon } from "./brand-icons"
import { describeHours, formatDeadline, paymentDeadline } from "@/features/orders/deadline"
import { useStoreSettings } from "./store-settings-provider"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"

const formSchema = z.object({ reference: paymentReferenceSchema })
type FormValues = z.input<typeof formSchema>

type PaymentPanelProps = {
  orderCode: string
  /** Last 4 digits of the order's phone number (identifies guests to the server). */
  phoneLast4: string
  total: number
  orderStatus: OrderStatus
  payment: OrderPayment
  /** Called after a payment is submitted. Defaults to refreshing the current page. */
  onSubmitted?: () => void
  /** When the order was placed: lets us show the exact time an unpaid order is cancelled automatically. */
  createdAt?: string
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div data-ui="store/CopyRow" className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
      <span data-ui="store/CopyRow/span" className="text-muted-foreground">{label}</span>
      <span data-ui="store/CopyRow/span-flex" className="flex min-w-0 items-center gap-1 font-mono font-semibold">
        <span data-ui="store/CopyRow/span-2" className="truncate">{value}</span>
        <button data-ui="store/CopyRow/button-grid"
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              toast.success("Copied")
            } catch {
              toast.error("Couldn't copy. Please select and copy it.")
            }
          }}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <CopyIcon className="size-3.5" />
        </button>
      </span>
    </div>
  )
}

function ReferenceForm({
  orderCode,
  phoneLast4,
  submitLabel,
  onSubmitted,
}: {
  orderCode: string
  phoneLast4: string
  submitLabel: string
  onSubmitted: () => void
}) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { reference: "" } })

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null)
    startTransition(async () => {
      const res = await submitPayment({ code: orderCode, phoneLast4, reference: values.reference })
      if (!res.ok) {
        setServerError(res.error)
        return
      }
      toast.success("Payment submitted. We'll verify it shortly.")
      onSubmitted()
    })
  })

  return (
    <form data-ui="store/ReferenceForm" onSubmit={onSubmit} noValidate className="space-y-1">
      <TextField
        label="UTR / UPI reference number" kind="paymentRef"
        placeholder="e.g. 412345678901"
        autoCapitalize="characters"
        autoComplete="off"
        hint="Find it in your UPI app under the payment details (usually a 12-digit number)."
        error={form.formState.errors.reference?.message}
        {...form.register("reference")}
      />
      {serverError && (
        <p data-ui="store/ReferenceForm/p" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {serverError}
        </p>
      )}
      <Button data-ui="store/ReferenceForm/Button" type="submit" size="lg" disabled={pending} className="w-full rounded-full">
        {pending && <Loader2Icon className="animate-spin" />} {submitLabel}
      </Button>
    </form>
  )
}

/**
 * Everything the customer needs to pay and to see where their payment stands:
 *  pending / rejected → pay by UPI, then submit the UTR
 *  submitted          → "we're verifying"
 *  paid               → receipt
 * Cash on delivery isn't offered; the order is confirmed after we verify the payment.
 */
export function PaymentPanel({ orderCode, phoneLast4, total, orderStatus, payment, onSubmitted, createdAt }: PaymentPanelProps) {
  const router = useRouter()
  const shop = useStoreSettings()
  const { upiId, upiPayeeName } = shop
  const [changing, setChanging] = useState(false)
  const done = onSubmitted ?? (() => router.refresh())
  // The pay form is tall and the "we're verifying" card is short: without this the reader is left at the bottom.
  useRevealOnChange(`${payment.paymentStatus}:${payment.paymentReference ?? ""}`)

  if (orderStatus === "cancelled" || payment.paymentStatus === "refunded") return null

  // ---- Paid: receipt ------------------------------------------------------
  if (payment.paymentStatus === "paid") {
    return (
      <section data-ui="store/PaymentPanel" aria-label="Payment" className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <h3 data-ui="store/PaymentPanel/h3-payment-received" className="flex items-center gap-2 font-sans text-base font-semibold text-emerald-900 dark:text-emerald-200">
          <BadgeCheckIcon className="size-5" /> Payment received
        </h3>
        <dl data-ui="store/PaymentPanel/dl" className="mt-3 space-y-1.5 text-sm">
          <div data-ui="store/PaymentPanel/div-flex" className="flex justify-between gap-4">
            <dt data-ui="store/PaymentPanel/dt" className="text-muted-foreground">Amount</dt>
            <dd data-ui="store/PaymentPanel/dd" className="font-semibold">{formatPrice(payment.paymentAmount ?? total)}</dd>
          </div>
          {payment.paymentMethod && (
            <div data-ui="store/PaymentPanel/div-flex-2" className="flex justify-between gap-4">
              <dt data-ui="store/PaymentPanel/dt-2" className="text-muted-foreground">Method</dt>
              <dd data-ui="store/PaymentPanel/dd-2" className="font-medium">{PAYMENT_METHOD_LABEL[payment.paymentMethod]}</dd>
            </div>
          )}
          {payment.paymentReference && (
            <div data-ui="store/PaymentPanel/div-flex-3" className="flex justify-between gap-4">
              <dt data-ui="store/PaymentPanel/dt-3" className="text-muted-foreground">Reference</dt>
              <dd data-ui="store/PaymentPanel/dd-3" className="min-w-0 text-right font-medium"><CopyableReference value={payment.paymentReference} /></dd>
            </div>
          )}
          {payment.paymentPaidAt && (
            <div data-ui="store/PaymentPanel/div-flex-4" className="flex justify-between gap-4">
              <dt data-ui="store/PaymentPanel/dt-4" className="text-muted-foreground">Date</dt>
              <dd data-ui="store/PaymentPanel/dd-4" className="font-medium">{formatDateTime(payment.paymentPaidAt)}</dd>
            </div>
          )}
        </dl>
        {payment.paymentNote && <p data-ui="store/PaymentPanel/p" className="mt-3 text-sm text-muted-foreground">{payment.paymentNote}</p>}
      </section>
    )
  }

  // ---- Submitted: waiting for the shop to verify ---------------------------
  if (payment.paymentStatus === "submitted" && !changing) {
    return (
      <section data-ui="store/PaymentPanel" aria-label="Payment" className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
        <h3 data-ui="store/PaymentPanel/h3-we-apos-re-verifying-y" className="flex items-center gap-2 font-sans text-base font-semibold text-amber-900 dark:text-amber-200">
          <HourglassIcon className="size-5 animate-pulse" /> We&apos;re verifying your payment
        </h3>
        <p data-ui="store/PaymentPanel/p-2" className="mt-2 text-sm text-muted-foreground">
          Reference <CopyableReference value={payment.paymentReference ?? ""} className="font-semibold text-foreground" />
          {payment.paymentSubmittedAt && <> · sent {formatDateTime(payment.paymentSubmittedAt)}</>}. Your order is
          confirmed as soon as we see the payment, usually within a few hours.
        </p>
        <button data-ui="store/PaymentPanel/button-entered-the-wrong-refe"
          type="button"
          onClick={() => setChanging(true)}
          className="mt-3 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          Entered the wrong reference? Change it
        </button>
      </section>
    )
  }

  // ---- Pending / rejected / changing: pay now ------------------------------
  const upiUrl = upiId ? buildUpiUrl({ upiId, payeeName: upiPayeeName, amount: total, orderCode }) : null
  const rejected = payment.paymentStatus === "failed"
  const expiryHours = shop.unpaidOrderExpiryHours
  const at = createdAt ? paymentDeadline(createdAt, expiryHours) : null
  const deadline = expiryHours > 0 ? { exact: at ? formatDeadline(at) : null, within: describeHours(expiryHours) } : null

  return (
    <section data-ui="store/PaymentPanel" aria-label="Pay for your order" className="space-y-5 rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm sm:p-6">
      <div data-ui="store/PaymentPanel/div">
        <h3 data-ui="store/PaymentPanel/h3-pay" className="font-heading text-xl font-semibold">Pay {formatPrice(total)} to confirm your order</h3>
        <p data-ui="store/PaymentPanel/p-3" className="mt-1 text-sm text-muted-foreground">
          Cash on delivery isn&apos;t available. Pay by UPI now, then enter the reference number below.
        </p>
        {deadline && (
          <p data-ui="store/PaymentPanel/p-flex" className="mt-2 flex items-start gap-2 rounded-xl bg-amber-100 p-3 text-xs/snug  text-amber-950 dark:bg-amber-900/30 dark:text-amber-100">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span data-ui="store/PaymentPanel/span-2">
              {deadline.exact ? (
                <>
                  Please pay by <span data-ui="store/PaymentPanel/span-3" className="font-semibold">{deadline.exact}</span>. If we don&apos;t receive the payment by then, this order is cancelled automatically and the items go back on sale.
                </>
              ) : (
                <>
                  Please pay within <span data-ui="store/PaymentPanel/span-4" className="font-semibold">{deadline.within}</span>. Unpaid orders are cancelled automatically after that and the items go back on sale.
                </>
              )}
              {" "}Already paid? Enter your UTR below and we&apos;ll keep your order.
            </span>
          </p>
        )}
      </div>

      {rejected && (
        <p data-ui="store/PaymentPanel/p-flex-2" role="alert" className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          <span data-ui="store/PaymentPanel/span-5">
            <span data-ui="store/PaymentPanel/span-6" className="font-semibold">We couldn&apos;t verify your last payment.</span>{" "}
            {payment.paymentNote ?? "Please check the reference number and submit it again."}
          </span>
        </p>
      )}

      {upiUrl && upiId ? (
        <div data-ui="store/PaymentPanel/div-2" className="space-y-4">
          <p data-ui="store/PaymentPanel/p-flex-3" className="flex items-center gap-2 text-sm font-semibold">
            <span data-ui="store/PaymentPanel/span-grid" className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
            Pay with any UPI app
          </p>

          {/* On a phone: open the UPI app. On desktop: scan the QR with your phone. */}
          <a data-ui="store/PaymentPanel/a-pay"
            href={upiUrl}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 md:hidden"
          >
            <SmartphoneIcon className="size-5" /> Pay {formatPrice(total)} with UPI app
          </a>
          <div data-ui="store/PaymentPanel/div-hidden" className="hidden items-center gap-4 rounded-2xl border bg-white p-4 md:flex">
            <QRCodeSVG value={upiUrl} size={132} marginSize={1} title={`UPI QR code to pay ${formatPrice(total)}`} />
            <div data-ui="store/PaymentPanel/div-3" className="text-sm text-neutral-700">
              <p data-ui="store/PaymentPanel/p-flex-4" className="flex items-center gap-2 font-semibold text-neutral-900">
                <QrCodeIcon className="size-4" /> Scan with any UPI app
              </p>
              <p data-ui="store/PaymentPanel/p-4" className="mt-1">Amount {formatPrice(total)} is filled in for you.</p>
            </div>
          </div>

          <div data-ui="store/PaymentPanel/div-4" className="space-y-2">
            <CopyRow label="UPI ID" value={upiId} />
            {upiPayeeName && <CopyRow label="Name" value={upiPayeeName} />}
            <CopyRow label="Amount" value={total.toFixed(2)} />
          </div>
        </div>
      ) : (
        <p data-ui="store/PaymentPanel/p-5" className="rounded-xl bg-muted p-4 text-sm">
          Payment details aren&apos;t set up on the website yet. Please message us on WhatsApp and we&apos;ll share them.
        </p>
      )}

      <div data-ui="store/PaymentPanel/div-5" className="space-y-3">
        <p data-ui="store/PaymentPanel/p-flex-5" className="flex items-center gap-2 text-sm font-semibold">
          <span data-ui="store/PaymentPanel/span-grid-2" className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
          After paying, enter the reference number
        </p>
        <ReferenceForm
          orderCode={orderCode}
          phoneLast4={phoneLast4}
          submitLabel={changing || rejected ? "Submit again" : "I've paid"}
          onSubmitted={() => {
            setChanging(false)
            done()
          }}
        />
      </div>

      {changing && (
        <button data-ui="store/PaymentPanel/button-keep-my-earlier-refere"
          type="button"
          onClick={() => setChanging(false)}
          className="block text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Keep my earlier reference
        </button>
      )}

      <a data-ui="store/PaymentPanel/a-send-payment-screensho"
        href={shopWhatsappLink(shop, `Hi! I paid for order ${orderCode}. Sending the payment screenshot.`)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex items-center gap-2 text-sm font-semibold text-whatsapp hover:underline")}
      >
        <WhatsAppIcon className="size-4" /> Send payment screenshot on WhatsApp (optional)
      </a>
    </section>
  )
}

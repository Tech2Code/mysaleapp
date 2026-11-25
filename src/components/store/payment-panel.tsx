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
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { createGatewayRetrySession, submitPayment, verifyGatewayPayment } from "@/features/orders/actions"
import { openGatewayCheckout } from "@/features/orders/gateway-client"
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
import { useToastAfter } from "@/hooks/use-toast-after"
import { useRevealOnChange } from "@/hooks/use-reveal-on-change"
import { useAuth } from "@/store/auth"
import styles from "./order-status.module.css"

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
  onSubmitted?: () => void | Promise<unknown>
  /** When the order was placed: lets us show the exact time an unpaid order is cancelled automatically. */
  createdAt?: string
  /** Last update time (e.g. when a rejected payment resets the auto-cancel clock). */
  updatedAt?: string
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.copyRowBox}>
      <span className={styles.copyRowLabel}>{label}</span>
      <span className={styles.copyRowValWrap}>
        <span className={styles.copyRowValText}>{value}</span>
        <button
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
          className={styles.copyRowIconBtn}
        >
          <CopyIcon className={styles.copyMiniSvg} />
        </button>
      </span>
    </div>
  )
}

function ReferenceForm({
  orderCode,
  phoneLast4,
  currentReference,
  submitLabel,
  onSubmitted,
}: {
  orderCode: string
  phoneLast4: string
  currentReference?: string | null
  submitLabel: string
  onSubmitted: () => void
}) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)
  const router = useRouter()
  const user = useAuth((s) => s.user)
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { reference: "" } })
  const refValue = useWatch({ control: form.control, name: "reference" })
  const refClean = (refValue ?? "").trim().toUpperCase()
  const rawPrev = (currentReference ?? "").trim().toUpperCase()
  const prevClean = rawPrev.includes("*") ? "" : rawPrev
  const isUnchangedOrEmpty = !refClean || (Boolean(prevClean) && refClean === prevClean)

  const onSubmit = form.handleSubmit((values) => {
    if (isUnchangedOrEmpty) return
    startTransition(async () => {
      const res = await submitPayment({ code: orderCode, phoneLast4, reference: values.reference })
      if (!res.ok) {
        const refMsg = res.fieldErrors?.reference?.[0]
        if (refMsg) {
          form.setError("reference", { message: refMsg })
        }
        toast.error(
          res.error,
          !user && /sign in/i.test(res.error)
            ? { action: { label: "Sign in", onClick: () => router.push("/login?next=/account/orders") } }
            : undefined
        )
        return
      }
      await onSubmitted()
      later(() => toast.success("Payment submitted. We'll verify it shortly."))
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className={styles.refFormStack}>
      <TextField
        label="UTR / UPI reference number" kind="paymentRef"
        required
        placeholder="e.g. 412345678901"
        autoCapitalize="characters"
        autoComplete="off"
        hint="Find it in your UPI app under the payment details (usually a 12-digit number)."
        error={form.formState.errors.reference?.message ?? (Boolean(prevClean) && refClean === prevClean ? "This is already your submitted reference number" : undefined)}
        {...form.register("reference")}
      />
      <Button type="submit" size="lg" disabled={pending || isUnchangedOrEmpty} className={styles.refSubmitBtn}>
        {pending && <Loader2Icon className={styles.spinIcon} />} {submitLabel}
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
export function PaymentPanel({ orderCode, phoneLast4, total, orderStatus, payment, onSubmitted, createdAt, updatedAt }: PaymentPanelProps) {
  const router = useRouter()
  const shop = useStoreSettings()
  const { upiId, upiPayeeName } = shop
  const [changing, setChanging] = useState(false)
  const [showMobileQr, setShowMobileQr] = useState(false)
  const [gwPending, startGwTransition] = useTransition()
  useBlockWhile(gwPending)
  const gwLater = useToastAfter(gwPending)
  const done = onSubmitted ?? (() => router.refresh())
  // The pay form is tall and the "we're verifying" card is short: without this the reader is left at the bottom.
  useRevealOnChange(`${payment.paymentStatus}:${payment.paymentReference ?? ""}`)

  if (orderStatus === "cancelled" || payment.paymentStatus === "refunded") return null

  // ---- Paid: receipt ------------------------------------------------------
  if (payment.paymentStatus === "paid") {
    return (
      <section aria-label="Payment" className={styles.paidReceiptBox}>
        <h3 className={styles.paidHeading}>
          <BadgeCheckIcon className={styles.badgeIcon} /> Payment received
        </h3>
        <dl className={styles.receiptDl}>
          <div className={styles.receiptRow}>
            <dt className={styles.receiptTerm}>Amount</dt>
            <dd className={styles.receiptValBold}>{formatPrice(payment.paymentAmount ?? total)}</dd>
          </div>
          {payment.paymentMethod && (
            <div className={styles.receiptRow}>
              <dt className={styles.receiptTerm}>Method</dt>
              <dd className={styles.receiptValMed}>{PAYMENT_METHOD_LABEL[payment.paymentMethod]}</dd>
            </div>
          )}
          {payment.paymentReference && (
            <div className={styles.receiptRow}>
              <dt className={styles.receiptTerm}>Reference</dt>
              <dd className={styles.receiptValMed}><CopyableReference value={payment.paymentReference} /></dd>
            </div>
          )}
          {payment.paymentPaidAt && (
            <div className={styles.receiptRow}>
              <dt className={styles.receiptTerm}>Date</dt>
              <dd className={styles.receiptValMed}>{formatDateTime(payment.paymentPaidAt)}</dd>
            </div>
          )}
        </dl>
        {payment.paymentNote && <p className={styles.paymentNoteText}>{payment.paymentNote}</p>}
      </section>
    )
  }

  // ---- Submitted: waiting for the shop to verify ---------------------------
  if (payment.paymentStatus === "submitted" && !changing) {
    return (
      <section aria-label="Payment" className={styles.verifyingBox}>
        <h3 className={styles.verifyingHeading}>
          <HourglassIcon className={styles.hourglassIcon} /> We&apos;re verifying your payment
        </h3>
        <p className={styles.verifyingSub}>
          Reference <CopyableReference value={payment.paymentReference ?? ""} className={styles.refHighlight} />
          {payment.paymentSubmittedAt && <> · sent {formatDateTime(payment.paymentSubmittedAt)}</>}. Your order is
          confirmed as soon as we see the payment, usually within a few hours.
        </p>
        <button
          type="button"
          onClick={() => setChanging(true)}
          className={styles.changeRefBtn}
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
  const at = createdAt ? paymentDeadline(createdAt, expiryHours, updatedAt) : null
  const deadline = expiryHours > 0 ? { exact: at ? formatDeadline(at) : null, within: describeHours(expiryHours) } : null

  const payViaGateway = () => {
    startGwTransition(async () => {
      try {
        const res = await createGatewayRetrySession({ code: orderCode, phoneLast4 })
        if (!res.ok) {
          toast.error(res.error)
          return
        }
        const outcome = await openGatewayCheckout(res.data.session)
        if (outcome.status === "dismissed") {
          toast.info("Payment window closed.")
          return
        }
        if (outcome.status === "failed" || outcome.status === "unsupported") {
          toast.error(outcome.error)
          return
        }
        const verified = await verifyGatewayPayment({
          code: orderCode,
          phoneLast4,
          gatewayOrderId: outcome.gatewayOrderId,
          paymentId: outcome.paymentId,
          signature: outcome.signature,
        })
        if (!verified.ok) {
          toast.error(verified.error)
          return
        }
        await done()
        gwLater(() => toast.success("Payment received! Your order is confirmed."))
      } catch {
        toast.error("Couldn't complete online payment. Please try again.")
      }
    })
  }

  if (shop.paymentMode === "gateway" && !changing) {
    return (
      <section aria-label="Pay for your order" className={styles.payNowPanel}>
        <div>
          <h3 className={styles.payPanelTitle}>
            {rejected ? `Retry payment (${formatPrice(total)})` : `Pay ${formatPrice(total)} to confirm your order`}
          </h3>
          <p className={styles.payPanelSub}>
            {rejected
              ? "Your previous online payment could not be completed. Retry securely via UPI, card, or netbanking."
              : "Complete your online payment securely via UPI, card, or netbanking for instant order confirmation."}
          </p>
          {deadline && (
            <p className={styles.deadlineNotice}>
              <ClockIcon className={styles.clockIcon} aria-hidden />
              <span>
                {deadline.exact ? (
                  <>
                    Please complete payment by <span className={styles.deadlineStrong}>{deadline.exact}</span>. Unpaid orders are cancelled automatically and items go back on sale.
                  </>
                ) : (
                  <>
                    Please complete payment within <span className={styles.deadlineStrong}>{deadline.within}</span>. Unpaid orders are cancelled automatically and items go back on sale.
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        {rejected && (
          <p role="alert" className={styles.rejectedAlert}>
            <AlertCircleIcon className={styles.alertCircleIcon} />
            <span>
              <span className={styles.rejectedStrong}>Previous payment attempt failed.</span>{" "}
              {payment.paymentNote ?? "Please try again or choose another payment method."}
            </span>
          </p>
        )}

        <div className={styles.upiStepStack}>
          <Button type="button" size="lg" disabled={gwPending} onClick={payViaGateway} className={styles.refSubmitBtn}>
            {gwPending && <Loader2Icon className={styles.spinIcon} />}
            {gwPending ? "Opening checkout…" : `Pay ${formatPrice(total)} securely`}
          </Button>
        </div>

        <a
          href={shopWhatsappLink(shop, `Hi! I need help paying for order ${orderCode}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.waScreenshotLink}
        >
          <WhatsAppIcon className={styles.waIcon} /> Need help? Message us on WhatsApp
        </a>
      </section>
    )
  }

  return (
    <section aria-label="Pay for your order" className={styles.payNowPanel}>
      <div>
        <h3 className={styles.payPanelTitle}>
          {rejected ? `Update payment reference (${formatPrice(total)})` : changing ? `Change payment reference (${formatPrice(total)})` : `Pay ${formatPrice(total)} to confirm your order`}
        </h3>
        <p className={styles.payPanelSub}>
          {rejected
            ? "Enter the correct 12-digit UPI reference number (UTR) below, or pay by UPI and enter the new UTR."
            : changing
              ? "Enter your corrected 12-digit UPI reference number (UTR) below."
              : "Cash on delivery isn't available. Pay by UPI now, then enter the reference number below."}
        </p>
        {deadline && !changing && (
          <p className={styles.deadlineNotice}>
            <ClockIcon className={styles.clockIcon} aria-hidden />
            <span>
              {deadline.exact ? (
                <>
                  Please submit a valid UTR by <span className={styles.deadlineStrong}>{deadline.exact}</span>. If we can&apos;t verify the payment by then, this order is cancelled automatically and the items go back on sale.
                </>
              ) : (
                <>
                  Please submit a valid UTR within <span className={styles.deadlineStrong}>{deadline.within}</span>. If we can&apos;t verify the payment after that, this order is cancelled automatically and the items go back on sale.
                </>
              )}
            </span>
          </p>
        )}
      </div>

      {rejected && (
        <p role="alert" className={styles.rejectedAlert}>
          <AlertCircleIcon className={styles.alertCircleIcon} />
          <span>
            <span className={styles.rejectedStrong}>We couldn&apos;t verify your last payment.</span>{" "}
            {payment.paymentNote ?? "Please check the reference number and submit it again."}
          </span>
        </p>
      )}

      {upiUrl && upiId ? (
        <div className={styles.upiStepStack}>
          <p className={styles.stepLabelRow}>
            <span className={styles.stepNumCircle}>1</span>
            Pay with any UPI app
          </p>

          {/* On a phone: open the UPI app or toggle QR code. On desktop: scan the QR with your phone. */}
          <a
            href={upiUrl}
            className={styles.upiAppBtn}
          >
            <SmartphoneIcon className={styles.phoneSvg} /> Pay {formatPrice(total)} with UPI app
          </a>
          <button

            type="button"
            onClick={() => setShowMobileQr((v) => !v)}
            aria-expanded={showMobileQr}
            className={styles.toggleQrBtn}
          >
            <QrCodeIcon className={styles.qrSvg} />
            {showMobileQr ? "Hide QR code" : "Show QR code (scan from another device)"}
          </button>
          <div

            className={cn(styles.qrCardBox, showMobileQr && styles.qrCardVisible)}
          >
            <div className={styles.qrWhitePad}>
              <QRCodeSVG value={upiUrl} size={132} marginSize={1} title={`UPI QR code to pay ${formatPrice(total)}`} />
            </div>
            <div className={styles.qrTextCol}>
              <p className={styles.qrTitleRow}>
                <QrCodeIcon className={styles.qrIcon} /> Scan with any UPI app
              </p>
              <p className={styles.qrSubNote}>Amount {formatPrice(total)} is filled in for you.</p>
            </div>
          </div>

          <div className={styles.copyRowsStack}>
            <CopyRow label="UPI ID" value={upiId} />
            {upiPayeeName && <CopyRow label="Name" value={upiPayeeName} />}
            <CopyRow label="Amount" value={total.toFixed(2)} />
          </div>
        </div>
      ) : (
        <p className={styles.noUpiFallback}>
          Payment details aren&apos;t set up on the website yet. Please message us on WhatsApp and we&apos;ll share them.
        </p>
      )}

      <div className={styles.utrStepStack}>
        <p className={styles.stepLabelRow}>
          <span className={styles.stepNumCircle}>2</span>
          After paying, enter the reference number
        </p>
        <ReferenceForm
          orderCode={orderCode}
          phoneLast4={phoneLast4}
          currentReference={changing ? payment.paymentReference : null}
          submitLabel={changing || rejected ? "Submit again" : "I've paid"}
          onSubmitted={() => {
            setChanging(false)
            done()
          }}
        />
      </div>

      {changing && (
        <button
          type="button"
          onClick={() => setChanging(false)}
          className={styles.keepPrevRefBtn}
        >
          Keep my earlier reference
        </button>
      )}

      <a
        href={shopWhatsappLink(shop, `Hi! I paid for order ${orderCode}. Sending the payment screenshot.`)}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.waScreenshotLink}
      >
        <WhatsAppIcon className={styles.waIcon} /> Send payment screenshot on WhatsApp (optional)
      </a>
    </section>
  )
}

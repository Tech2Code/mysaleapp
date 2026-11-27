"use client"
import { RefundSummary } from "@/components/shared/refund-summary"
import { OrderStatusBadge } from "@/components/shared/order-status-badge"

import { zodResolver } from "@hookform/resolvers/zod"
import { HashIcon, Loader2Icon, PackageSearchIcon, PhoneIcon, SearchIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"
import { TextField } from "@/components/form"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { Button } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import { trackOrder } from "@/features/orders/actions"
import { placeholderTrackedOrder } from "@/features/orders/placeholders"
import type { StoreSettings } from "@/features/settings/types"
import { trackOrderSchema } from "@/features/orders/schema"
import { canRequestAgain, customerStatusLine, returnStage, stageInputOf } from "@/features/orders/returns"
import { composeOrderCode, STATUS_META, stripOrderPrefix, type TrackedOrder } from "@/features/orders/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatDate } from "@/lib/format"
import { WhatsAppIcon } from "./brand-icons"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { CopyButton } from "@/components/shared/copy-button"
import { CancelOrder } from "./cancel-order"
import { RefreshButton } from "@/components/shared/refresh-button"
import { RequestReturn, ReturnRequestsPanel } from "./request-return"
import { ReturnsList } from "@/components/shared/returns-list"
import { DeliveryEditor } from "./delivery-editor"
import { useStoreSettings } from "./store-settings-provider"
import { PaymentPanel } from "./payment-panel"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import styles from "./order-status.module.css"

type TrackInput = z.input<typeof trackOrderSchema>

function EmptyState({ signedIn, prefix }: { signedIn: boolean; prefix: string }) {
  const hints = [
    { icon: HashIcon, text: `Find the order code in your WhatsApp message (like ${prefix}-7F3K9Q) and enter the part after ${prefix}-.` },
    { icon: PhoneIcon, text: "Enter the last 4 digits of the phone number you ordered with." },
    { icon: PackageSearchIcon, text: "See live status, courier and tracking details right here." },
  ]
  return (
    <div className={styles.trackEmptyBox}>
      <div className={styles.searchIconCircle}>
        <PackageSearchIcon className={styles.pkgIcon} />
      </div>
      <h2 className={styles.emptyTitle}>Your order status will appear here</h2>
      <ol className={styles.hintsList}>
        {hints.map((h, i) => (
          <li key={h.text} className={styles.hintRow}>
            <span className={styles.hintNumBadge}>
              {i + 1}
            </span>
            {h.text}
          </li>
        ))}
      </ol>
      <p className={styles.accountPrompt}>
        {signedIn ? (
          <>
            Ordered with your account?{" "}
            <Link href="/account/orders" className={styles.promptLink}>
              See all your orders
            </Link>
          </>
        ) : (
          <>
            Have an account?{" "}
            <Link href="/login?next=/account/orders" className={styles.promptLink}>
              Sign in to see all your orders
            </Link>
          </>
        )}
      </p>
    </div>
  )
}

const PLACEHOLDER_QUERY = { code: "KK-7F3K9Q", phoneLast4: "3210" }

/** The order card on the right. Also rendered with a placeholder order, inside <Skeletonize>, while a lookup is running. */
function TrackResult({
  result,
  query,
  shop,
  signedIn,
  refetch,
}: {
  result: TrackedOrder
  query: { code: string; phoneLast4: string } | null
  shop: StoreSettings
  signedIn: boolean
  refetch: (phoneLast4?: string) => Promise<void>
}) {
  const itemCount = result.items.reduce((n, i) => n + i.quantity, 0)
  const isOwner = Boolean(
    signedIn &&
      (result.isOwner ??
        Boolean(
          result.delivery ||
            result.paymentMethod ||
            (result.paymentReference && !result.paymentReference.includes("*"))
        ))
  )
  const needsOwnerSignIn = Boolean(result.requiresSignIn && !isOwner)
  return (
    <m.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={styles.trackResultCard}
    >
      <div className={styles.resultHeader}>
        <div>
          <div className={styles.codeRow}>
            <p className={styles.orderCodeText}>{result.orderCode}</p>
            <CopyButton value={stripOrderPrefix(result.orderCode, shop.orderCodePrefix)} label="Order code" />
          </div>
          <p className={styles.placedMetaText}>
            Placed {formatDate(result.createdAt)} · {result.city}
          </p>
        </div>
        <div className={styles.headerBadgesRow}>
          <RefreshButton onRefresh={() => refetch()} />
          <OrderStatusBadge status={result.status} returnStage={returnStage(stageInputOf(result))} paymentStatus={result.paymentStatus} audience="customer" pulse alwaysShow />
        </div>
      </div>
      <p className={styles.statusDescription}>
                {customerStatusLine(STATUS_META[result.status].description, returnStage(stageInputOf(result)), {
                  canRequestAgain: result.status === "delivered" ? canRequestAgain(result.returnRequests, result.returnWindow.open) : undefined,
                })}
              </p>
      {query && !needsOwnerSignIn ? (
        <ReturnRequestsPanel
          requests={result.returnRequests}
          returns={result.returns}
          refundedInFull={returnStage(stageInputOf(result))?.key === "refunded"}
          orderCode={result.orderCode}
          phoneLast4={isOwner ? undefined : query.phoneLast4}
          onChanged={() => refetch()}
        />
      ) : (
        <ReturnsList
          returns={result.returns}
          audience="customer"
          refundedInFull={returnStage(stageInputOf(result))?.key === "refunded"}
        />
      )}
      <RefundSummary order={result} />
      {result.cancellation && (
        <CancellationNotice
          cancellation={result.cancellation}
          paymentStatus={result.paymentStatus}
          audience="customer"
          showPrivateRefs={isOwner}
        />
      )}
      {needsOwnerSignIn && (
        <p className={styles.guestCityNotice}>
          This order belongs to a signed-in account.{" "}
          <Link href={`/login?next=${encodeURIComponent(`/account/orders/${result.orderCode}`)}`} className={styles.signInInlineLink}>
            Sign in to view full details or manage this order
          </Link>
          .
        </p>
      )}
      {/* Guests only get what they can act on (pay / "we're verifying"). The receipt, UTR and the priced item list
          need no code+4-digits lookup to be readable by anyone, so they stay in the signed-in order page. */}
      {query && !needsOwnerSignIn && (result.paymentStatus !== "paid" || isOwner) && (
        <PaymentPanel
          orderCode={result.orderCode}
          phoneLast4={query.phoneLast4}
          total={result.total}
          orderStatus={result.status}
          payment={result}
          createdAt={result.createdAt}
          updatedAt={result.updatedAt}
          onSubmitted={() => refetch()}
        />
      )}
      <OrderTimeline status={result.status} history={result.history} shipping={result.shipping} returnInput={stageInputOf(result)} audience="customer" />
      {query && !needsOwnerSignIn && (
        <div className={styles.orderActionsBar}>
          <RequestReturn
            orderCode={result.orderCode}
            phoneLast4={isOwner ? undefined : query.phoneLast4}
            status={result.status}
            items={result.items}
            history={result.history}
            returns={result.returns}
            requests={result.returnRequests}
            charges={{
              shippingFee: result.shippingFee,
              extraFees: result.extraFees,
              discountAmount: result.discountAmount,
              paidAmount: result.paymentAmount ?? result.total,
              refundedAmount: result.refundedAmount,
            }}
            orderDelivery={result.delivery ?? null}
            window={result.returnWindow}
            whatsappUrl={shopWhatsappLink(shop, `Hi! I have a question about returning my order ${result.orderCode}.`)}
            onDone={() => refetch()}
          />
          <CancelOrder
            orderCode={result.orderCode}
            // The signed-in owner is recognised by session; everyone else is a guest and must type the full number to cancel
            phoneLast4={isOwner ? undefined : query.phoneLast4}
            status={result.status}
            paymentStatus={result.paymentStatus}
            whatsappUrl={shopWhatsappLink(shop, `Hi! I want to cancel my order ${result.orderCode}.`)}
            onCancelled={() => refetch()}
          />
        </div>
      )}
      <section aria-label="Items in this order" className={styles.itemsSummarySection}>
        <h3 className={styles.itemsHeading}>
          {itemCount} item{itemCount === 1 ? "" : "s"} in this order
        </h3>
        <ul className={styles.itemsList}>
          {result.items.map((i) => {
            const suffix = i.variantLabel ? ` — ${i.variantLabel}` : ""
            const cleanName = suffix && i.name.endsWith(suffix) ? i.name.slice(0, -suffix.length) : i.name
            return (
              <li key={i.variantId ? `${i.productId}::${i.variantId}` : i.productId} className={styles.itemLine}>
                <span className={styles.itemNameCol}>
                  <span className={styles.itemName}>{cleanName}</span>
                  {i.variantLabel && <span className={styles.itemVariantPill}>{i.variantLabel}</span>}
                </span>
                <span className={styles.itemQty}>× {i.quantity}</span>
              </li>
            )
          })}
        </ul>
        <p className={styles.invoiceHint}>
          {isOwner ? (
            <>
              Need the invoice or full order details?{" "}
              <Link href={`/account/orders/${encodeURIComponent(result.orderCode)}`} className={styles.invoiceLink}>
                Open in My orders
              </Link>
            </>
          ) : signedIn ? (
            <>
              Looking for orders placed with your account?{" "}
              <Link href="/account/orders" className={styles.invoiceLink}>
                Open My orders
              </Link>
            </>
          ) : (
            <>
              Need the invoice or payment details?{" "}
              <Link href="/login?next=/account/orders" className={styles.invoiceLink}>
                Sign in and open My orders
              </Link>
            </>
          )}
        </p>
      </section>
      {query && !needsOwnerSignIn && result.delivery && (
        <DeliveryEditor
          orderCode={result.orderCode}
          delivery={result.delivery}
          editable={result.status === "pending"}
          status={result.status}
          phoneLast4={query.phoneLast4}
          onChanged={(newLast4) => refetch(newLast4)}
        />
      )}
      {/* Guests don't get the address back (anyone with the code + 4-digits could read it): only the city,
          and a way to change it while the order is still pending. */}
      {!result.delivery && result.status === "pending" && (
        <p className={styles.guestCityNotice}>
          Delivering to <span className={styles.cityStrong}>{result.city}</span>. To change the address,{" "}
          <a

            href={shopWhatsappLink(shop, `Hi! I want to change the delivery address of my order ${result.orderCode}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.waChangeLink}
          >
            message us on WhatsApp
          </a>
          {signedIn ? (
            "."
          ) : (
            <>
              {" "}or{" "}
              <Link href="/login?next=/account/orders" className={styles.signInInlineLink}>
                sign in
              </Link>
              .
            </>
          )}
        </p>
      )}
    </m.section>
  )
}

export function TrackOrder() {
  const params = useSearchParams()
  const urlCode = params.get("code") ?? ""
  return <TrackOrderBody key={urlCode} urlCode={urlCode} />
}

function TrackOrderBody({ urlCode }: { urlCode: string }) {
  const shop = useStoreSettings()
  const orderPrefix = (shop.orderCodePrefix || "KK").trim().toUpperCase().replace(/-+$/, "")
  const initialSuffix = stripOrderPrefix(urlCode, orderPrefix)
  const user = useAuth((s) => s.user)
  const signedIn = Boolean(user)
  const [result, setResult] = useState<TrackedOrder | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [query, setQuery] = useState<{ code: string; phoneLast4: string } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const form = useForm<TrackInput>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { code: initialSuffix ? composeOrderCode(initialSuffix, orderPrefix) : "", phoneLast4: "" },
  })
  const [codeSuffix, setCodeSuffix] = useState(initialSuffix)

  useEffect(() => {
    const nextSuffix = stripOrderPrefix(urlCode, orderPrefix)
    form.reset({ code: nextSuffix ? composeOrderCode(nextSuffix, orderPrefix) : "", phoneLast4: "" })
    return () => {
      setCodeSuffix("")
      form.reset({ code: "", phoneLast4: "" })
      setResult(null)
      setQuery(null)
    }
  }, [urlCode, orderPrefix, form])

  // On phones the result sits below the form: bring it into view after the reader's own lookup only
  // (refresh / payment / cancel re-reads must not move the page).
  const [lookups, setLookups] = useState(0)
  useEffect(() => {
    if (lookups > 0 && window.matchMedia("(max-width: 1023px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [lookups])

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const res = await trackOrder(values)
      if (res.ok) {
        setLookups((n) => n + 1)
        setResult(res.data)
        setQuery({ code: res.data.orderCode, phoneLast4: String(values.phoneLast4) })
      } else {
        setResult(null)
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0] && (field === "code" || field === "phoneLast4")) {
            form.setError(field, { message: msgs[0] })
          }
        }
        toast.error(res.error)
      }
    })
  })

  /** Re-read the order after a payment or address change. */
  const refetch = async (phoneLast4?: string) => {
    if (!query) return
    const next = { code: query.code, phoneLast4: phoneLast4 ?? query.phoneLast4 }
    if (phoneLast4) {
      form.setValue("phoneLast4", phoneLast4)
    }
    const res = await trackOrder(next)
    if (res.ok) {
      setResult(res.data)
      setQuery(next)
    } else {
      toast.error(res.error)
    }
  }

  // Re-fetch automatically when auth user changes so signing in unlocks owner delivery/payment details immediately
  const userId = user?.id ?? null
  const prevUserIdRef = useRef(userId)
  useEffect(() => {
    if (prevUserIdRef.current === userId) return
    prevUserIdRef.current = userId
    if (!query) return
    let cancelled = false
    trackOrder(query)
      .then((res) => {
        if (!cancelled && res.ok) setResult(res.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [userId, query])

  return (
    <div className={cn(styles.trackBodyGrid, Boolean(result) && styles.trackBodyGridAlignedStart)}>
      {/* Left: find your order */}
      <form onSubmit={onSubmit} noValidate className={cn(styles.lookupForm, Boolean(result) && styles.lookupFormSticky)}>
        <div>
          <h2 className={styles.formTitle}>Find your order</h2>
          <p className={styles.formSubtitle}>
            {signedIn ? "Takes 5 seconds. Enter your order code and phone's last 4 digits." : "Takes 5 seconds. No login needed."}
          </p>
        </div>
        <div className={styles.prefixFieldWrap}>
          <label htmlFor="track-order-code" className={styles.prefixFieldLabel}>
            Order code
          </label>
          <div className={cn(styles.prefixInputShell, form.formState.errors.code && styles.prefixInputShellError)}>
            <span className={styles.prefixFixedBadge} aria-hidden="true">
              {orderPrefix}-
            </span>
            <input
              id="track-order-code"
              type="text"
              value={codeSuffix}
              onChange={(e) => {
                const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "")
                const cleanSuffix = stripOrderPrefix(raw, orderPrefix)
                setCodeSuffix(cleanSuffix)
                form.setValue("code", cleanSuffix ? composeOrderCode(cleanSuffix, orderPrefix) : "", {
                  shouldValidate: form.formState.isSubmitted,
                })
              }}
              placeholder="7F3K9Q"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(form.formState.errors.code)}
              aria-describedby={form.formState.errors.code ? "track-order-code-err" : undefined}
              className={styles.prefixSuffixInput}
            />
          </div>
          {form.formState.errors.code?.message && (
            <p id="track-order-code-err" role="alert" className={styles.prefixFieldError}>
              {form.formState.errors.code.message}
            </p>
          )}
        </div>
        <TextField
          label="Last 4 digits of phone" kind="orderLast4"
          inputMode="numeric"
          maxLength={4}
          placeholder="3210"
          error={form.formState.errors.phoneLast4?.message}
          {...form.register("phoneLast4")}
        />
        <Button type="submit" size="lg" disabled={pending} className={styles.submitBtn}>
          {pending ? <Loader2Icon className={styles.spinIcon} /> : <SearchIcon />} Track order
        </Button>
        <div className={styles.helpFooter}>
          <p className={styles.helpPrompt}>Can&apos;t find your order code?</p>
          <a
            href={shopWhatsappLink(shop, "Hi! I need help finding my order.")}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.waHelpLink}
          >
            <WhatsAppIcon className={styles.waIcon} /> Ask us on WhatsApp
          </a>
        </div>
      </form>

      {/* Right: order details */}
      <div ref={resultRef} aria-live="polite" data-reveal-top className={styles.resultColumn}>
        <AnimatePresence mode="wait">
          {pending ? (
            <m.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.fullHeightBox}>
              <Skeletonize>
                <TrackResult result={placeholderTrackedOrder()} query={PLACEHOLDER_QUERY} shop={shop} signedIn={signedIn} refetch={async () => {}} />
              </Skeletonize>
            </m.div>
          ) : result ? (
            <TrackResult key={result.orderCode} result={result} query={query} shop={shop} signedIn={signedIn} refetch={refetch} />
          ) : (
            <m.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.fullHeightBox}>
              <EmptyState signedIn={signedIn} prefix={orderPrefix} />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

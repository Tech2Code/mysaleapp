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
import { STATUS_META, type TrackedOrder } from "@/features/orders/types"
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

type TrackInput = z.input<typeof trackOrderSchema>

const hints = [
  { icon: HashIcon, text: "Find the order code in your WhatsApp message (like KK-7F3K9Q)." },
  { icon: PhoneIcon, text: "Enter the last 4 digits of the phone number you ordered with." },
  { icon: PackageSearchIcon, text: "See live status, courier and tracking details right here." },
]

function EmptyState() {
  return (
    <div data-ui="store/EmptyState" className="flex h-full min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed bg-card/50 p-6 sm:p-8 text-center">
      <div data-ui="store/EmptyState/div-grid" className="grid size-16 place-items-center rounded-full bg-secondary animate-float">
        <PackageSearchIcon className="size-7 text-primary" />
      </div>
      <h2 data-ui="store/EmptyState/h2-your-order-status-will" className="mt-5 font-heading text-2xl font-semibold">Your order status will appear here</h2>
      <ol data-ui="store/EmptyState/ol" className="mt-6 max-w-sm space-y-3 text-left text-sm text-muted-foreground">
        {hints.map((h, i) => (
          <li data-ui="store/EmptyState/li-flex" key={h.text} className="flex gap-3">
            <span data-ui="store/EmptyState/span-grid" className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-primary">
              {i + 1}
            </span>
            {h.text}
          </li>
        ))}
      </ol>
      <p data-ui="store/EmptyState/p" className="mt-6 text-sm text-muted-foreground">
        Signed in?{" "}
        <Link data-ui="store/EmptyState/Link-see-all-your-orders" href="/account/orders" className="font-semibold text-primary underline-offset-4 hover:underline">
          See all your orders
        </Link>
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
  refetch,
}: {
  result: TrackedOrder
  query: { code: string; phoneLast4: string } | null
  shop: StoreSettings
  refetch: (phoneLast4?: string) => Promise<void>
}) {
  const itemCount = result.items.reduce((n, i) => n + i.quantity, 0)
  return (
    <m.section data-ui="store/TrackResult"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 rounded-3xl border bg-card p-6 sm:p-8"
    >
      <div data-ui="store/TrackResult/div-flex" className="flex flex-wrap items-start justify-between gap-3">
        <div data-ui="store/TrackResult/div">
          <div data-ui="store/TrackResult/div-flex-2" className="flex flex-wrap items-center gap-2">
            <p data-ui="store/TrackResult/p" className="font-mono text-xl font-semibold">{result.orderCode}</p>
            <CopyButton value={result.orderCode} label="Order ID" />
          </div>
          <p data-ui="store/TrackResult/p-2" className="text-sm text-muted-foreground">
            Placed {formatDate(result.createdAt)} · {result.city}
          </p>
        </div>
        <div data-ui="store/TrackResult/div-flex-3" className="flex flex-wrap items-center gap-2">
          <RefreshButton onRefresh={() => refetch()} />
          <OrderStatusBadge status={result.status} returnStage={returnStage(stageInputOf(result))} paymentStatus={result.paymentStatus} audience="customer" pulse alwaysShow />
        </div>
      </div>
      <p data-ui="store/TrackResult/p-3" className="text-sm text-muted-foreground">
                {customerStatusLine(STATUS_META[result.status].description, returnStage(stageInputOf(result)), {
                  canRequestAgain: result.status === "delivered" ? canRequestAgain(result.returnRequests, result.returnWindow.open) : undefined,
                })}
              </p>
      {query ? <ReturnRequestsPanel requests={result.returnRequests} returns={result.returns} refundedInFull={returnStage(stageInputOf(result))?.key === "refunded"} orderCode={result.orderCode} phoneLast4={query.phoneLast4} onChanged={() => void refetch()} /> : <ReturnsList returns={result.returns} audience="customer" refundedInFull={returnStage(stageInputOf(result))?.key === "refunded"} />}
      <RefundSummary order={result} />
      {result.cancellation && (
        <CancellationNotice cancellation={result.cancellation} paymentStatus={result.paymentStatus} audience="customer" />
      )}
      {/* Guests only get what they can act on (pay / "we're verifying"). The receipt, UTR and the priced item list
          need no code+4-digits lookup to be readable by anyone, so they stay in the signed-in order page. */}
      {query && result.paymentStatus !== "paid" && (
        <PaymentPanel
          orderCode={result.orderCode}
          phoneLast4={query.phoneLast4}
          total={result.total}
          orderStatus={result.status}
          payment={result}
          createdAt={result.createdAt}
          onSubmitted={() => void refetch()}
        />
      )}
      <OrderTimeline status={result.status} history={result.history} shipping={result.shipping} returnInput={stageInputOf(result)} audience="customer" />
      {query && (
        <div data-ui="store/TrackResult/div-flex-4" className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:items-center">
          <RequestReturn
            orderCode={result.orderCode}
            phoneLast4={query.phoneLast4}
            status={result.status}
            items={result.items}
            returns={result.returns}
            requests={result.returnRequests}
            charges={{ shippingFee: result.shippingFee, extraFees: result.extraFees }}
            window={result.returnWindow}
            whatsappUrl={shopWhatsappLink(shop, `Hi! I have a question about returning my order ${result.orderCode}.`)}
            onDone={() => void refetch()}
          />
          <CancelOrder
            orderCode={result.orderCode}
            // `delivery` only comes back for the signed-in owner; everyone else is a guest and must type the full number to cancel
            phoneLast4={result.delivery ? undefined : query.phoneLast4}
            status={result.status}
            paymentStatus={result.paymentStatus}
            whatsappUrl={shopWhatsappLink(shop, `Hi! I want to cancel my order ${result.orderCode}.`)}
            onCancelled={() => void refetch()}
          />
        </div>
      )}
      <section data-ui="store/TrackResult/section-items-in-this-order" aria-label="Items in this order" className="border-t pt-5 text-sm">
        <h3 data-ui="store/TrackResult/h3-item" className="font-sans font-semibold">
          {itemCount} item{itemCount === 1 ? "" : "s"} in this order
        </h3>
        <ul data-ui="store/TrackResult/ul" className="mt-2 space-y-1 text-muted-foreground">
          {result.items.map((i) => (
            <li data-ui="store/TrackResult/li-flex" key={i.productId} className="flex gap-2">
              <span data-ui="store/TrackResult/span" className="min-w-0 flex-1 truncate leading-normal">{i.name}</span>
              <span data-ui="store/TrackResult/span-2" className="shrink-0">× {i.quantity}</span>
            </li>
          ))}
        </ul>
        <p data-ui="store/TrackResult/p-4" className="mt-3 text-xs text-muted-foreground">
          Need the invoice or payment details?{" "}
          <Link data-ui="store/TrackResult/Link-sign-in-and-open-my-or" href="/account/orders" className="font-semibold text-primary underline-offset-4 hover:underline">
            Sign in and open My orders
          </Link>
        </p>
      </section>
      {query && result.delivery && (
        <DeliveryEditor
          orderCode={result.orderCode}
          delivery={result.delivery}
          editable={result.status === "pending"}
          status={result.status}
          phoneLast4={query.phoneLast4}
          onChanged={(newLast4) => void refetch(newLast4)}
        />
      )}
      {/* Guests don't get the address back (anyone with the code + 4 digits could read it): only the city,
          and a way to change it while the order is still pending. */}
      {!result.delivery && result.status === "pending" && (
        <p data-ui="store/TrackResult/p-5" className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
          Delivering to <span data-ui="store/TrackResult/span-3" className="font-semibold text-foreground">{result.city}</span>. To change the address,{" "}
          <a
            data-ui="store/TrackResult/a-message-us-on-whatsapp"
            href={shopWhatsappLink(shop, `Hi! I want to change the delivery address of my order ${result.orderCode}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            message us on WhatsApp
          </a>{" "}
          or sign in.
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
  const [result, setResult] = useState<TrackedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [query, setQuery] = useState<{ code: string; phoneLast4: string } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const form = useForm<TrackInput>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { code: urlCode, phoneLast4: "" },
  })

  useEffect(() => {
    form.reset({ code: urlCode, phoneLast4: "" })
    return () => {
      form.reset({ code: "", phoneLast4: "" })
      setError(null)
      setResult(null)
      setQuery(null)
    }
  }, [urlCode, form])

  // On phones the result sits below the form: bring it into view after the reader's own lookup only
  // (refresh / payment / cancel re-reads must not move the page).
  const [lookups, setLookups] = useState(0)
  useEffect(() => {
    if (lookups > 0 && window.matchMedia("(max-width: 1023px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [lookups])

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const res = await trackOrder(values)
      if (res.ok) {
        setLookups((n) => n + 1)
        setResult(res.data)
        setQuery({ code: res.data.orderCode, phoneLast4: String(values.phoneLast4) })
      } else {
        setResult(null)
        setError(res.error)
      }
    })
  })

  /** Re-read the order after a payment or address change. */
  const refetch = async (phoneLast4?: string) => {
    if (!query) return
    const next = { code: query.code, phoneLast4: phoneLast4 ?? query.phoneLast4 }
    const res = await trackOrder(next)
    if (res.ok) {
      setResult(res.data)
      setQuery(next)
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div data-ui="store/TrackOrderBody" className={`grid gap-x-6 gap-y-4 lg:grid-cols-[380px_1fr] lg:gap-8 ${result ? "items-start" : "items-stretch"}`}>
      {/* Left: find your order */}
      <form data-ui="store/TrackOrderBody/form" onSubmit={onSubmit} noValidate className={`space-y-2 rounded-3xl border bg-card p-6 sm:p-7 ${result ? "lg:sticky-store" : ""}`}>
        <div data-ui="store/TrackOrderBody/div">
          <h2 data-ui="store/TrackOrderBody/h2-find-your-order" className="text-2xl font-semibold">Find your order</h2>
          <p data-ui="store/TrackOrderBody/p" className="mt-1 text-sm text-muted-foreground">Takes 5 seconds. No login needed.</p>
        </div>
        <TextField
          label="Order code" kind="orderCode"
          className="font-mono uppercase"
          placeholder="KK-7F3K9Q"
          autoCapitalize="characters"
          error={form.formState.errors.code?.message}
          {...form.register("code")}
        />
        <TextField
          label="Last 4 digits of phone" kind="orderLast4"
          inputMode="numeric"
          maxLength={4}
          placeholder="3210"
          error={form.formState.errors.phoneLast4?.message}
          {...form.register("phoneLast4")}
        />
        <Button data-ui="store/TrackOrderBody/Button-track-order" type="submit" size="lg" disabled={pending} className="w-full rounded-full">
          {pending ? <Loader2Icon className="animate-spin" /> : <SearchIcon />} Track order
        </Button>
        {error && (
          <p data-ui="store/TrackOrderBody/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div data-ui="store/TrackOrderBody/div-2" className="mt-auto border-t pt-4 text-sm">
          <p data-ui="store/TrackOrderBody/p-3" className="text-muted-foreground">Can&apos;t find your order code?</p>
          <a data-ui="store/TrackOrderBody/a-ask-us-on-whatsapp"
            href={shopWhatsappLink(shop, "Hi! I need help finding my order.")}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 font-semibold text-whatsapp hover:underline"
          >
            <WhatsAppIcon className="size-4" /> Ask us on WhatsApp
          </a>
        </div>
      </form>

      {/* Right: order details */}
      <div data-ui="store/TrackOrderBody/div-3" ref={resultRef} aria-live="polite" data-reveal-top className="scroll-mt-24 *:h-full">
        <AnimatePresence mode="wait">
          {pending ? (
            <m.div data-ui="store/TrackOrderBody/m.div" key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Skeletonize>
                <TrackResult result={placeholderTrackedOrder()} query={PLACEHOLDER_QUERY} shop={shop} refetch={async () => {}} />
              </Skeletonize>
            </m.div>
          ) : result ? (
            <TrackResult key={result.orderCode} result={result} query={query} shop={shop} refetch={refetch} />
          ) : (
            <m.div data-ui="store/TrackOrderBody/m.div-2" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <EmptyState />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { HashIcon, Loader2Icon, PackageSearchIcon, PhoneIcon, SearchIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { TextField } from "@/components/form"
import { OrderSummary } from "@/components/shared/order-summary"
import { OrderTimeline } from "@/components/shared/order-timeline"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { trackOrder } from "@/features/orders/actions"
import { trackOrderSchema } from "@/features/orders/schema"
import { STATUS_META, type TrackedOrder } from "@/features/orders/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatDate } from "@/lib/format"
import { WhatsAppIcon } from "./brand-icons"
import { CancellationNotice } from "@/components/shared/cancellation-notice"
import { CopyButton } from "@/components/shared/copy-button"
import { CancelOrder } from "./cancel-order"
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

function ResultSkeleton() {
  return (
    <div data-ui="store/ResultSkeleton" className="space-y-5 rounded-3xl border bg-card p-6 sm:p-8" aria-hidden>
      <div data-ui="store/ResultSkeleton/div-flex" className="flex justify-between">
        <Skeleton data-ui="store/ResultSkeleton/Skeleton" className="h-10 w-48 rounded-xl" />
        <Skeleton data-ui="store/ResultSkeleton/Skeleton-2" className="h-8 w-24 rounded-full" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div data-ui="store/ResultSkeleton/div-flex-2" key={i} className="flex gap-4">
          <Skeleton data-ui="store/ResultSkeleton/Skeleton-3" className="size-9 rounded-full" />
          <div data-ui="store/ResultSkeleton/div" className="flex-1 space-y-2">
            <Skeleton data-ui="store/ResultSkeleton/Skeleton-4" className="h-4 w-32" />
            <Skeleton data-ui="store/ResultSkeleton/Skeleton-5" className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TrackOrder() {
  const shop = useStoreSettings()
  const params = useSearchParams()
  const [result, setResult] = useState<TrackedOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const [query, setQuery] = useState<{ code: string; phoneLast4: string } | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const form = useForm<TrackInput>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { code: params.get("code") ?? "", phoneLast4: "" },
  })

  // On phones the result sits below the form, so bring it into view once it arrives.
  useEffect(() => {
    if (result && window.matchMedia("(max-width: 1023px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [result])

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const res = await trackOrder(values)
      if (res.ok) {
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
    }
  }

  return (
    <div data-ui="store/TrackOrder" className="grid items-start gap-x-6 gap-y-1 lg:grid-cols-[380px_1fr] lg:gap-8">
      {/* Left: find your order */}
      <form data-ui="store/TrackOrder/form" onSubmit={onSubmit} noValidate className="space-y-2 rounded-3xl border bg-card p-6 sm:p-7 lg:sticky-store">
        <div data-ui="store/TrackOrder/div">
          <h2 data-ui="store/TrackOrder/h2-find-your-order" className="text-2xl font-semibold">Find your order</h2>
          <p data-ui="store/TrackOrder/p" className="mt-1 text-sm text-muted-foreground">Takes 5 seconds. No login needed.</p>
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
        <Button data-ui="store/TrackOrder/Button-track-order" type="submit" size="lg" disabled={pending} className="w-full rounded-full">
          {pending ? <Loader2Icon className="animate-spin" /> : <SearchIcon />} Track order
        </Button>
        {error && (
          <p data-ui="store/TrackOrder/p-2" role="alert" className="rounded-xl bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div data-ui="store/TrackOrder/div-2" className="border-t pt-4 text-sm">
          <p data-ui="store/TrackOrder/p-3" className="text-muted-foreground">Can&apos;t find your order code?</p>
          <a data-ui="store/TrackOrder/a-ask-us-on-whatsapp"
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
      <div data-ui="store/TrackOrder/div-3" ref={resultRef} aria-live="polite" className="scroll-mt-24">
        <AnimatePresence mode="wait">
          {pending ? (
            <motion.div data-ui="store/TrackOrder/m-div" key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ResultSkeleton />
            </motion.div>
          ) : result ? (
            <motion.section data-ui="store/TrackOrder/m-section"
              key={result.orderCode}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-6 rounded-3xl border bg-card p-6 sm:p-8"
            >
              <div data-ui="store/TrackOrder/div-flex" className="flex flex-wrap items-start justify-between gap-3">
                <div data-ui="store/TrackOrder/div-4">
                  <div data-ui="store/TrackOrder/div-flex-2" className="flex flex-wrap items-center gap-2">
                    <p data-ui="store/TrackOrder/p-4" className="font-mono text-xl font-semibold">{result.orderCode}</p>
                    <CopyButton value={result.orderCode} label="Order ID" />
                  </div>
                  <p data-ui="store/TrackOrder/p-5" className="text-sm text-muted-foreground">
                    Placed {formatDate(result.createdAt)} · {result.city}
                  </p>
                </div>
                <StatusBadge status={result.status} pulse />
              </div>
              <p data-ui="store/TrackOrder/p-6" className="text-sm text-muted-foreground">{STATUS_META[result.status].description}.</p>
              {query && <ReturnRequestsPanel requests={result.returnRequests} orderCode={result.orderCode} phoneLast4={query.phoneLast4} onChanged={() => void refetch()} />}
              <ReturnsList returns={result.returns} audience="customer" />
              {result.cancellation && (
                <CancellationNotice cancellation={result.cancellation} paymentStatus={result.paymentStatus} audience="customer" />
              )}
              {query && (
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
              <OrderTimeline status={result.status} history={result.history} shipping={result.shipping} />
              {query && (
                <div data-ui="store/TrackOrder/div-flex-3" className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:items-center">
                  <RequestReturn
                    orderCode={result.orderCode}
                    phoneLast4={query.phoneLast4}
                    status={result.status}
                    items={result.items}
                    returns={result.returns}
                    requests={result.returnRequests}
                    window={result.returnWindow}
                    whatsappUrl={shopWhatsappLink(shop, `Hi! I have a question about returning my order ${result.orderCode}.`)}
                    onDone={() => void refetch()}
                  />
                  <CancelOrder
                    orderCode={result.orderCode}
                    phoneLast4={query.phoneLast4}
                    status={result.status}
                    paymentStatus={result.paymentStatus}
                    whatsappUrl={shopWhatsappLink(shop, `Hi! I want to cancel my order ${result.orderCode}.`)}
                    onCancelled={() => void refetch()}
                  />
                </div>
              )}
              <OrderSummary order={result} bare />
              {query && result.delivery && (
                <DeliveryEditor
                  orderCode={result.orderCode}
                  delivery={result.delivery}
                  editable
                  phoneLast4={query.phoneLast4}
                  onChanged={(newLast4) => void refetch(newLast4)}
                />
              )}
            </motion.section>
          ) : (
            <motion.div data-ui="store/TrackOrder/m-div-2" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <EmptyState />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

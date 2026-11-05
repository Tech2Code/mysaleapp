"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PlacedOrder } from "@/features/orders/actions"
import { trackOrder } from "@/features/orders/actions"
import type { TrackedOrder } from "@/features/orders/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { cn } from "@/lib/utils"
import { LAST_ORDER_KEY } from "./checkout-form"
import { WhatsAppIcon } from "./brand-icons"
import { PaymentPanel } from "./payment-panel"
import { useStoreSettings } from "./store-settings-provider"

const noopSubscribe = () => () => {}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

const HEADLINE: Record<string, { title: string; text: string }> = {
  pending: { title: "Order placed!", text: "Complete the payment below and we'll confirm your order." },
  failed: { title: "Payment needs attention", text: "We couldn't verify your payment. Please check the details and submit it again." },
  submitted: { title: "Payment submitted", text: "Thank you! We're verifying your payment and will confirm your order shortly." },
  paid: { title: "Payment received", text: "Your order is confirmed. We'll start getting it ready." },
}

/**
 * Shown right after checkout, and again if the page is reloaded. The payment state always
 * comes from the server, so a refresh never shows the "pay now" screen to someone who already paid.
 */
export function OrderPlaced() {
  const shop = useStoreSettings()
  const code = (useSearchParams().get("code") ?? "").toUpperCase()
  // sessionStorage is read as an external store: null on the server, real value on the client.
  const raw = useSyncExternalStore(noopSubscribe, () => readSession(LAST_ORDER_KEY), () => null)

  const order = useMemo<PlacedOrder | null>(() => {
    try {
      const parsed = raw ? (JSON.parse(raw) as PlacedOrder) : null
      return parsed?.orderCode === code ? parsed : null
    } catch {
      return null
    }
  }, [raw, code])

  const [state, setState] = useState<TrackedOrder | null>(null)

  const load = useCallback(async () => {
    if (!order) return
    const res = await trackOrder({ code: order.orderCode, phoneLast4: order.phoneLast4 })
    if (res.ok) setState(res.data)
  }, [order])

  // Read the real payment state on mount (and whenever the order changes).
  useEffect(() => {
    if (!order) return
    let cancelled = false
    trackOrder({ code: order.orderCode, phoneLast4: order.phoneLast4 }).then((res) => {
      if (!cancelled && res.ok) setState(res.data)
    })
    return () => {
      cancelled = true
    }
  }, [order])

  const headline = state ? (HEADLINE[state.paymentStatus] ?? HEADLINE.pending) : HEADLINE.pending

  return (
    <div data-ui="store/OrderPlaced" className="mx-auto max-w-xl text-center">
      <motion.div data-ui="store/OrderPlaced/m-div-grid"
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto grid size-24 place-items-center rounded-full bg-linear-to-br from-success-solid to-whatsapp-solid text-white shadow-2xl shadow-success/30"
      >
        <CheckIcon className="size-12" strokeWidth={3} />
      </motion.div>

      <motion.div data-ui="store/OrderPlaced/m-div" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 data-ui="store/OrderPlaced/h1" className="mt-8 text-4xl font-semibold">{state ? headline.title : "Order placed!"}</h1>
        <p data-ui="store/OrderPlaced/p" className="mt-3 text-muted-foreground">{state ? headline.text : HEADLINE.pending.text}</p>

        {code && (
          <button data-ui="store/OrderPlaced/button-flex"
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(code)
              toast.success("Order code copied")
            }}
            className="mx-auto mt-6 flex items-center gap-2 rounded-full border bg-card px-5 py-2.5 font-mono text-lg font-semibold tracking-wider transition-colors hover:bg-muted"
            aria-label={`Copy order code ${code}`}
          >
            {code} <CopyIcon className="size-4 text-muted-foreground" />
          </button>
        )}

        <div data-ui="store/OrderPlaced/div" className="mt-8 text-left">
          {!order ? (
            <p data-ui="store/OrderPlaced/p-2" className="rounded-2xl border bg-card p-5 text-center text-sm text-muted-foreground">
              To pay for this order, open{" "}
              <Link data-ui="store/OrderPlaced/Link-track-order" href={`/track?code=${code}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                Track order
              </Link>{" "}
              and enter your order code with the last 4 digits of your phone.
            </p>
          ) : state ? (
            <PaymentPanel
              orderCode={state.orderCode}
              phoneLast4={order.phoneLast4}
              total={state.total}
              orderStatus={state.status}
              payment={state}
              onSubmitted={() => void load()}
            />
          ) : (
            // never flash the "pay now" screen before we know the real payment state
            <Skeleton data-ui="store/OrderPlaced/Skeleton" className="h-72 rounded-2xl" aria-hidden />
          )}
        </div>

        <div data-ui="store/OrderPlaced/div-flex" className="mt-8 flex flex-wrap justify-center gap-3">
          <Link data-ui="store/OrderPlaced/Link-track-this-order" href={`/track?code=${code}`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-6")}>
            Track this order
          </Link>
          <Link data-ui="store/OrderPlaced/Link-continue-shopping" href="/products" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "rounded-full px-6")}>
            Continue shopping
          </Link>
        </div>

        <a data-ui="store/OrderPlaced/a-send-order-details-to-"
          href={order?.whatsappUrl ?? shopWhatsappLink(shop, `Hi! I placed order ${code}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-whatsapp hover:underline"
        >
          <WhatsAppIcon className="size-4" /> Send order details to us on WhatsApp (optional)
        </a>
      </motion.div>
    </div>
  )
}

"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import * as m from "motion/react-m"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import { Skeletonize } from "@/components/shared/skeletonize"
import type { PlacedOrder } from "@/features/orders/actions"
import { trackOrder } from "@/features/orders/actions"
import { placeholderPlacedOrder, placeholderTrackedOrder } from "@/features/orders/placeholders"
import { stripOrderPrefix, type TrackedOrder } from "@/features/orders/types"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { LAST_ORDER_KEY } from "./checkout-form"
import { WhatsAppIcon } from "./brand-icons"
import styles from "./order-status.module.css"
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
  submitted: { title: "Order placed & payment submitted!", text: "Thank you! We're verifying your UPI payment and will confirm your order shortly." },
  paid: { title: "Payment received", text: "Your order is confirmed. We'll start getting it ready." },
}

/**
 * Shown right after checkout, and again if the page is reloaded. The payment state always
 * comes from the server, so a refresh never shows the "pay now" screen to someone who already paid.
 */
function OrderPlacedWithParams() {
  const urlCode = (useSearchParams().get("code") ?? "").toUpperCase()
  return <OrderPlacedBody preview={false} urlCode={urlCode} />
}

/** `preview`: render a placeholder order and read nothing (loading.tsx wraps it in <Skeletonize>). */
export function OrderPlaced({ preview = false }: { preview?: boolean }) {
  if (preview) return <OrderPlacedBody preview urlCode="" />
  return <OrderPlacedWithParams />
}

function OrderPlacedBody({ preview, urlCode }: { preview: boolean; urlCode: string }) {
  const shop = useStoreSettings()
  const user = useAuth((s) => s.user)
  const signedIn = Boolean(user)
  // sessionStorage is read as an external store: null on the server, real value on the client.
  const raw = useSyncExternalStore(noopSubscribe, () => readSession(LAST_ORDER_KEY), () => null)

  const parsedSession = useMemo<PlacedOrder | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as PlacedOrder) : null
    } catch {
      return null
    }
  }, [raw])

  const code = preview ? placeholderPlacedOrder().orderCode : (urlCode || parsedSession?.orderCode || "")
  const myOrderHref = code ? `/account/orders/${encodeURIComponent(code)}` : "/account/orders"
  const trackHref = code ? `/track?code=${encodeURIComponent(code)}` : "/track"

  const order = useMemo<PlacedOrder | null>(() => {
    if (preview) return placeholderPlacedOrder()
    return parsedSession?.orderCode === code ? parsedSession : null
  }, [parsedSession, code, preview])

  const [state, setState] = useState<TrackedOrder | null>(preview ? placeholderTrackedOrder({ paymentStatus: "submitted" }) : null)
  const [lookupFailed, setLookupFailed] = useState(false)
  const optimisticState = useMemo<TrackedOrder | null>(() => {
    if (!order) return null
    const confirmed = order.paymentConfirmed === true
    return {
      ...placeholderTrackedOrder({ paymentStatus: confirmed ? "paid" : "submitted" }),
      orderCode: order.orderCode,
      total: order.total,
      status: confirmed ? "confirmed" : "pending",
      paymentStatus: confirmed ? "paid" : "submitted",
      paymentReference: order.paymentReference ?? null,
      createdAt: order.createdAt ?? placeholderTrackedOrder().createdAt,
      isOwner: signedIn,
    }
  }, [order, signedIn])
  const activeState = state ?? optimisticState
  const isOwner = Boolean(signedIn && (state ? state.isOwner : true))
  const orderDetailHref = order && code ? myOrderHref : "/account/orders"

  const load = useCallback(async () => {
    if (!order) return
    try {
      const res = await trackOrder({ code: order.orderCode, phoneLast4: order.phoneLast4 })
      if (res.ok) {
        setLookupFailed(false)
        setState(res.data)
      }
    } catch {
      /* keep current view on transient refresh failure */
    }
  }, [order])

  // Read the real payment state on mount (and whenever the order or signed-in user changes).
  const userId = user?.id ?? null

  // Always open Order Placed at the very top of the viewport (web & mobile), even after keyboard dismissal on /checkout.
  useLayoutEffect(() => {
    if (preview || typeof window === "undefined") return
    const scrollTopNow = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    scrollTopNow()
    const rafId = window.requestAnimationFrame(scrollTopNow)
    const timerId = window.setTimeout(scrollTopNow, 120)
    return () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(timerId)
    }
  }, [preview, code])

  useEffect(() => {
    if (!order || preview) return
    let cancelled = false
    queueMicrotask(() => setLookupFailed(false))
    trackOrder({ code: order.orderCode, phoneLast4: order.phoneLast4 })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setLookupFailed(false)
          setState(res.data)
        } else {
          setLookupFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLookupFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [order, preview, userId])

  const headline = activeState
    ? (HEADLINE[activeState.paymentStatus] ?? HEADLINE.submitted)
    : {
        title: "Order placed!",
        text: "Thanks for shopping with us — we've received your order.",
      }
  const whatsappHref =
    order?.whatsappUrl && order.whatsappUrl.startsWith("https://wa.me/")
      ? order.whatsappUrl
      : shopWhatsappLink(shop, code ? `Hi! I placed order ${code}.` : "Hi! I placed an order.")

  return (
    <div className={styles.orderPlacedWrap}>
      <m.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className={styles.checkBadge}
      >
        <CheckIcon className={styles.checkSvg} strokeWidth={3} aria-hidden="true" />
      </m.div>

      <m.div initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.25 }}>
        <h1 className={styles.placedHeadline}>{activeState ? headline.title : "Order placed & payment submitted!"}</h1>
        <p className={styles.placedSubtext}>{activeState ? headline.text : HEADLINE.submitted.text}</p>

        {code && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(stripOrderPrefix(code, shop.orderCodePrefix))
                toast.success("Order code copied")
              } catch {
                toast.error("Couldn't copy. Please select and copy the code.")
              }
            }}
            className={styles.codeCopyBtn}
            aria-label={`Copy order code ${code}`}
          >
            {code} <CopyIcon className={styles.copySvg} aria-hidden="true" />
          </button>
        )}

        <div className={styles.panelMount}>
          {!order ? (
            <p className={styles.statusFallbackCard}>
              {signedIn ? (
                <>
                  To check your order status and payment verification, open{" "}
                  <Link href="/account/orders" className={styles.inlineAccentLink}>
                    My orders
                  </Link>{" "}
                  or{" "}
                  <Link href={trackHref} className={styles.inlineAccentLink}>
                    Track order
                  </Link>
                  .
                </>
              ) : (
                <>
                  To check your order status and payment verification, open{" "}
                  <Link href={trackHref} className={styles.inlineAccentLink}>
                    Track order
                  </Link>{" "}
                  and enter your order code with the last 4 digits of your phone.
                </>
              )}
            </p>
          ) : lookupFailed && !state ? (
            <p role="alert" className={styles.statusFallbackCard}>
              {signedIn ? (
                <>
                  We couldn&apos;t load your order details just now. Open{" "}
                  <Link href="/account/orders" className={styles.inlineAccentLink}>
                    My orders
                  </Link>{" "}
                  or{" "}
                  <Link href={trackHref} className={styles.inlineAccentLink}>
                    Track order
                  </Link>{" "}
                  to check your order status.
                </>
              ) : (
                <>
                  We couldn&apos;t load your order details just now. Open{" "}
                  <Link href={trackHref} className={styles.inlineAccentLink}>
                    Track order
                  </Link>{" "}
                  and enter your order code with the last 4 digits of your phone to check your order status.
                </>
              )}
            </p>
          ) : activeState ? (
            <PaymentPanel
              orderCode={activeState.orderCode}
              phoneLast4={order.phoneLast4}
              total={activeState.total}
              orderStatus={activeState.status}
              payment={activeState}
              createdAt={activeState.createdAt}
              updatedAt={activeState.updatedAt}
              onSubmitted={() => load()}
            />
          ) : (
            // Show the compact "verifying payment" skeleton matching the newly placed order state
            <Skeletonize>
              <PaymentPanel
                orderCode={order.orderCode}
                phoneLast4={order.phoneLast4}
                total={order.total}
                orderStatus="pending"
                payment={placeholderTrackedOrder({ paymentStatus: "submitted" })}
              />
            </Skeletonize>
          )}
        </div>

        <div className={styles.actionBtnRow}>
          <Link href={isOwner ? orderDetailHref : trackHref} className={cn(buttonVariants({ variant: "outline", size: "lg" }), styles.pillBtn)}>
            {isOwner ? "View in My orders" : "Track this order"}
          </Link>
          <Link href="/products" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), styles.pillBtn)}>
            Continue shopping
          </Link>
        </div>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.whatsappSendLink}
        >
          <WhatsAppIcon className={styles.waIcon} /> Send order details to us on WhatsApp (optional)
        </a>
      </m.div>
    </div>
  )
}

"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { toast } from "sonner"
import { buttonVariants } from "@/components/ui/button"
import type { PlacedOrder } from "@/features/orders/actions"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LAST_ORDER_KEY } from "./checkout-form"
import { WhatsAppIcon } from "./brand-icons"

const REDIRECT_SECONDS = 4
/** Remembers that we already opened WhatsApp for this order (so "Back" doesn't redirect again). */
const SENT_KEY = "kk-last-order-sent"

const noopSubscribe = () => () => {}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function markSent(code: string) {
  try {
    sessionStorage.setItem(SENT_KEY, code)
  } catch {
    // ignore (private mode)
  }
}

export function OrderPlaced() {
  const code = (useSearchParams().get("code") ?? "").toUpperCase()
  // sessionStorage is read as an external store: null on the server, real value on the client.
  const raw = useSyncExternalStore(noopSubscribe, () => readSession(LAST_ORDER_KEY), () => null)
  const sent = useSyncExternalStore(noopSubscribe, () => readSession(SENT_KEY), () => null)

  const order = useMemo<PlacedOrder | null>(() => {
    try {
      const parsed = raw ? (JSON.parse(raw) as PlacedOrder) : null
      return parsed?.orderCode === code ? parsed : null
    } catch {
      return null
    }
  }, [raw, code])

  const [elapsed, setElapsed] = useState(0)
  const [cancelled, setCancelled] = useState(false)
  const autoRedirect = Boolean(order) && !cancelled && sent !== code
  const seconds = autoRedirect ? Math.max(0, REDIRECT_SECONDS - elapsed) : null

  // Countdown tick (state is only set from the timer callback).
  useEffect(() => {
    if (!autoRedirect) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [autoRedirect])

  // Auto-open WhatsApp once the countdown finishes.
  useEffect(() => {
    if (seconds === 0 && order) {
      markSent(code)
      window.location.href = order.whatsappUrl
    }
  }, [seconds, order, code])

  const cancelRedirect = () => {
    setCancelled(true)
    markSent(code)
  }

  const whatsappUrl = order?.whatsappUrl ?? shopWhatsappLink(`Hi! I just placed order ${code}.`)

  return (
    <div className="mx-auto max-w-lg text-center">
      <motion.div
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
        className="mx-auto grid size-24 place-items-center rounded-full bg-linear-to-br from-success to-whatsapp text-white shadow-2xl shadow-success/30"
      >
        <CheckIcon className="size-12" strokeWidth={3} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="mt-8 text-4xl font-semibold">Order saved!</h1>
        <p className="mt-3 text-muted-foreground">
          One last step — send it to us on WhatsApp so we can confirm delivery and payment.
        </p>

        {code && (
          <button
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
        {order && <p className="mt-2 text-sm text-muted-foreground">Total {formatPrice(order.subtotal)}</p>}

        <a
          href={whatsappUrl}
          onClick={cancelRedirect}
          className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-whatsapp text-lg font-semibold text-white shadow-xl shadow-whatsapp/30 transition-transform hover:-translate-y-0.5"
        >
          <WhatsAppIcon className="size-6" /> Send order on WhatsApp
        </a>

        {seconds !== null && seconds > 0 && (
          <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
            Opening WhatsApp in {seconds}s…{" "}
            <button type="button" onClick={cancelRedirect} className="font-medium underline underline-offset-4">
              Cancel
            </button>
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/track?code=${code}`} className={cn(buttonVariants({ variant: "outline" }), "rounded-full px-5")}>
            Track this order
          </Link>
          <Link href="/products" className={cn(buttonVariants({ variant: "ghost" }), "rounded-full px-5")}>
            Continue shopping
          </Link>
        </div>
      </motion.div>
    </div>
  )
}

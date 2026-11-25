import type { GatewayClientSession } from "./types"

export type GatewayCheckoutOutcome =
  | {
      status: "paid"
      gatewayOrderId: string
      paymentId: string
      signature: string
    }
  | { status: "dismissed" }
  | { status: "failed"; error: string }
  | { status: "unsupported"; error: string }

type RazorpayHandlerResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayFailureResponse = {
  error?: { description?: string }
}

type RazorpayInstance = {
  open(): void
  on(event: "payment.failed", cb: (resp: RazorpayFailureResponse) => void): void
}

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

const scriptLoadCache = new Map<string, Promise<void>>()

function loadExternalScript(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window unavailable"))
  }
  const existing = scriptLoadCache.get(src)
  if (existing) return existing

  const promise = new Promise<void>((resolve, reject) => {
    const already = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (already) {
      if (window.Razorpay) {
        resolve()
        return
      }
      already.addEventListener("load", () => resolve(), { once: true })
      already.addEventListener("error", () => reject(new Error("Failed to load payment SDK")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadCache.delete(src)
      reject(new Error("Failed to load payment SDK"))
    }
    document.head.appendChild(script)
  })

  scriptLoadCache.set(src, promise)
  return promise
}

/**
 * Opens the configured Payment Gateway UI lazily on demand (loads 0 bytes in Manual UPI mode).
 */
export async function openGatewayCheckout(session: GatewayClientSession): Promise<GatewayCheckoutOutcome> {
  if (session.checkoutUrl) {
    window.location.assign(session.checkoutUrl)
    return { status: "dismissed" }
  }

  if (session.provider === "razorpay") {
    try {
      await loadExternalScript("https://checkout.razorpay.com/v1/checkout.js")
    } catch {
      return { status: "failed", error: "Could not load Razorpay checkout. Please check your connection and try again." }
    }

    const Razorpay = window.Razorpay
    if (!Razorpay) {
      return { status: "failed", error: "Payment popup failed to initialise. Please try again." }
    }

    return new Promise<GatewayCheckoutOutcome>((resolve) => {
      let settled = false
      const finish = (outcome: GatewayCheckoutOutcome) => {
        if (settled) return
        settled = true
        resolve(outcome)
      }

      const instance = new Razorpay({
        key: session.keyId,
        amount: session.amountPaise,
        currency: session.currency,
        name: session.shopName,
        description: `Order ${session.orderCode}`,
        order_id: session.gatewayOrderId,
        prefill: {
          name: session.customerName,
          contact: `+91${session.customerPhone}`,
        },
        notes: {
          orderCode: session.orderCode,
        },
        handler: (response: RazorpayHandlerResponse) => {
          finish({
            status: "paid",
            gatewayOrderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
        },
        modal: {
          ondismiss: () => finish({ status: "dismissed" }),
        },
      })

      instance.on("payment.failed", (resp: RazorpayFailureResponse) => {
        finish({
          status: "failed",
          error: resp.error?.description ?? "Payment could not be completed. Please try again.",
        })
      })

      instance.open()
    })
  }

  return {
    status: "unsupported",
    error: `Checkout launcher for "${session.provider}" is not configured yet. See payment-gateway-setup.md.`,
  }
}

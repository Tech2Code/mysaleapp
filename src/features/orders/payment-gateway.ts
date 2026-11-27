import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabaseConfig } from "@/lib/supabase/config"
import { PAYMENT_GATEWAY_PROVIDERS, type GatewayClientSession, type PaymentGatewayProvider, type PaymentMethod } from "./types"

let serviceClient: SupabaseClient | null = null

/**
 * Server-only Supabase client with `service_role` privileges, used exclusively for
 * gateway payment session updates and webhook verification (`confirm_gateway_payment`).
 * Returns null when `SUPABASE_SERVICE_ROLE_KEY` is not set (e.g. Manual UPI mode).
 */
export function getServiceRoleSupabase(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!isSupabaseConfigured || !key) return null
  serviceClient ??= createClient(supabaseConfig.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return serviceClient
}

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex")
}

export function timingSafeHexEqual(expectedHex: string, receivedHex: string): boolean {
  const a = expectedHex.trim().toLowerCase()
  const b = receivedHex.trim().toLowerCase()
  if (!a || !b || a.length !== b.length || a.length % 2 !== 0) return false
  if (!/^[0-9a-f]+$/.test(a) || !/^[0-9a-f]+$/.test(b)) return false
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
}

export type VerifyClientPaymentResult =
  | { ok: true; paymentReference: string; method: PaymentMethod }
  | { ok: false; error: string }

export type WebhookParseResult =
  | {
      ok: true
      event: "paid"
      orderCode?: string | null
      gatewayOrderId: string
      paymentReference: string
      amountInr: number
      method: PaymentMethod
    }
  | {
      ok: true
      event: "failed"
      orderCode?: string | null
      gatewayOrderId?: string | null
      reason?: string | null
    }
  | { ok: true; event: "ignored" }
  | { ok: false; error: string }

export interface PaymentGatewayAdapter {
  provider: PaymentGatewayProvider
  isConfigured(): boolean
  createOrderSession(input: {
    orderCode: string
    amountInr: number
    shopName: string
    customerName: string
    customerPhone: string
  }): Promise<GatewayClientSession>
  verifyClientPayment(input: {
    expectedGatewayOrderId: string
    expectedAmountInr: number
    gatewayOrderId: string
    paymentId: string
    signature: string
  }): Promise<VerifyClientPaymentResult>
  parseAndVerifyWebhook(input: { rawBody: string; headers: Headers }): Promise<WebhookParseResult>
}

function mapRazorpayMethod(raw: unknown): PaymentMethod {
  const m = typeof raw === "string" ? raw.toLowerCase() : ""
  if (m === "upi") return "upi"
  if (m === "card") return "card"
  if (m === "netbanking" || m === "bank_transfer") return "bank_transfer"
  return "other"
}

function razorpayEnv() {
  const keyId = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim()
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim()
  const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim()
  return { keyId, keySecret, webhookSecret }
}

function razorpayBasicAuth(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`
}

const razorpayAdapter: PaymentGatewayAdapter = {
  provider: "razorpay",

  isConfigured() {
    const { keyId, keySecret } = razorpayEnv()
    return Boolean(keyId && keySecret && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
  },

  async createOrderSession(input) {
    const { keyId, keySecret } = razorpayEnv()
    if (!keyId || !keySecret) {
      throw new Error("GATEWAY_UNAVAILABLE")
    }
    const amountPaise = Math.round(input.amountInr * 100)
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: razorpayBasicAuth(keyId, keySecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: input.orderCode,
        notes: { orderCode: input.orderCode },
      }),
    })
    if (!res.ok) {
      throw new Error("GATEWAY_UNAVAILABLE")
    }
    const data = (await res.json()) as { id?: string; amount?: number; currency?: string }
    if (!data.id) {
      throw new Error("GATEWAY_UNAVAILABLE")
    }
    return {
      provider: "razorpay",
      gatewayOrderId: data.id,
      amountPaise: Number(data.amount ?? amountPaise),
      currency: "INR",
      keyId,
      orderCode: input.orderCode,
      shopName: input.shopName,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
    }
  },

  async verifyClientPayment(input) {
    const { keyId, keySecret } = razorpayEnv()
    if (!keyId || !keySecret) {
      return { ok: false, error: "Gateway keys are not configured." }
    }
    if (input.gatewayOrderId !== input.expectedGatewayOrderId) {
      return { ok: false, error: "Order reference mismatch." }
    }
    const expectedSig = hmacSha256Hex(keySecret, `${input.expectedGatewayOrderId}|${input.paymentId}`)
    if (!timingSafeHexEqual(expectedSig, input.signature)) {
      return { ok: false, error: "Invalid payment signature." }
    }

    const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}`, {
      method: "GET",
      headers: { Authorization: razorpayBasicAuth(keyId, keySecret) },
    })
    if (!res.ok) {
      return { ok: false, error: "Could not confirm payment with Razorpay." }
    }
    const payment = (await res.json()) as {
      id?: string
      order_id?: string
      amount?: number
      currency?: string
      status?: string
      method?: string
    }

    const expectedPaise = Math.round(input.expectedAmountInr * 100)
    if (
      payment.id !== input.paymentId ||
      payment.order_id !== input.expectedGatewayOrderId ||
      payment.currency !== "INR" ||
      Number(payment.amount) !== expectedPaise ||
      payment.status !== "captured"
    ) {
      return { ok: false, error: "Payment is not captured for this order." }
    }

    return {
      ok: true,
      paymentReference: payment.id,
      method: mapRazorpayMethod(payment.method),
    }
  },

  async parseAndVerifyWebhook({ rawBody, headers }) {
    const { webhookSecret } = razorpayEnv()
    const signature = headers.get("x-razorpay-signature") ?? ""
    if (!webhookSecret || !signature) {
      return { ok: false, error: "Missing webhook signature or secret." }
    }
    const expectedSig = hmacSha256Hex(webhookSecret, rawBody)
    if (!timingSafeHexEqual(expectedSig, signature)) {
      return { ok: false, error: "Invalid webhook signature." }
    }

    let payload: {
      event?: string
      payload?: {
        payment?: {
          entity?: {
            id?: string
            order_id?: string
            amount?: number
            currency?: string
            method?: string
            status?: string
            error_description?: string
            notes?: { orderCode?: string }
          }
        }
        order?: {
          entity?: {
            id?: string
            receipt?: string
            notes?: { orderCode?: string }
          }
        }
      }
    }

    try {
      payload = JSON.parse(rawBody) as typeof payload
    } catch {
      return { ok: false, error: "Invalid webhook JSON." }
    }

    const eventName = payload.event ?? ""
    const payEntity = payload.payload?.payment?.entity
    const orderEntity = payload.payload?.order?.entity

    if (eventName === "payment.captured" || eventName === "order.paid") {
      const gatewayOrderId = payEntity?.order_id || orderEntity?.id || ""
      const paymentReference = payEntity?.id || ""
      const amountPaise = Number(payEntity?.amount ?? 0)
      if (payEntity?.currency && payEntity.currency !== "INR") {
        return { ok: false, error: "Unsupported payment currency." }
      }
      if (!gatewayOrderId || !paymentReference || !Number.isFinite(amountPaise) || amountPaise <= 0) {
        return { ok: false, error: "Incomplete payment payload." }
      }
      return {
        ok: true,
        event: "paid",
        orderCode: payEntity?.notes?.orderCode ?? orderEntity?.notes?.orderCode ?? orderEntity?.receipt ?? null,
        gatewayOrderId,
        paymentReference,
        amountInr: Math.round(amountPaise) / 100,
        method: mapRazorpayMethod(payEntity?.method),
      }
    }

    if (eventName === "payment.failed") {
      return {
        ok: true,
        event: "failed",
        orderCode: payEntity?.notes?.orderCode ?? null,
        gatewayOrderId: payEntity?.order_id ?? null,
        reason: payEntity?.error_description ?? "Payment failed at Razorpay.",
      }
    }

    return { ok: true, event: "ignored" }
  },
}

/**
 * Placeholder adapter factory for future providers (`cashfree`, `phonepe`, `stripe`).
 * See `payment-gateway-setup.md` Phase 3 for the 3-step implementation recipe.
 */
function createStubAdapter(provider: Exclude<PaymentGatewayProvider, "razorpay">): PaymentGatewayAdapter {
  return {
    provider,
    isConfigured: () => false,
    async createOrderSession() {
      throw new Error(`Gateway adapter "${provider}" is not implemented yet. See payment-gateway-setup.md.`)
    },
    async verifyClientPayment() {
      return { ok: false, error: `Gateway adapter "${provider}" is not implemented yet. See payment-gateway-setup.md.` }
    },
    async parseAndVerifyWebhook() {
      return { ok: false, error: `Gateway adapter "${provider}" is not implemented yet.` }
    },
  }
}

export const GATEWAY_ADAPTERS: Record<PaymentGatewayProvider, PaymentGatewayAdapter> = {
  razorpay: razorpayAdapter,
  cashfree: createStubAdapter("cashfree"),
  phonepe: createStubAdapter("phonepe"),
  stripe: createStubAdapter("stripe"),
}

export function getGatewayAdapter(provider: PaymentGatewayProvider): PaymentGatewayAdapter {
  return GATEWAY_ADAPTERS[provider]
}

export function isGatewayConfigured(provider: PaymentGatewayProvider): boolean {
  return GATEWAY_ADAPTERS[provider].isConfigured()
}

export function listConfiguredGateways(): PaymentGatewayProvider[] {
  return PAYMENT_GATEWAY_PROVIDERS.filter((p) => GATEWAY_ADAPTERS[p].isConfigured())
}

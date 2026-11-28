import { revalidatePath } from "next/cache"
import { connection } from "next/server"
import { getGatewayAdapter, getServiceRoleSupabase } from "@/features/orders/payment-gateway"
import { PAYMENT_GATEWAY_PROVIDERS, type PaymentGatewayProvider } from "@/features/orders/types"

function resolveProvider(request: Request): PaymentGatewayProvider | null {
  const url = new URL(request.url)
  const q = url.searchParams.get("provider")?.trim().toLowerCase()
  if (q && (PAYMENT_GATEWAY_PROVIDERS as readonly string[]).includes(q)) {
    return q as PaymentGatewayProvider
  }
  if (request.headers.has("x-razorpay-signature")) return "razorpay"
  if (request.headers.has("x-webhook-signature")) return "cashfree"
  if (request.headers.has("stripe-signature")) return "stripe"
  return null
}

/**
 * Payment gateway webhook endpoint (`POST /api/webhooks/payment?provider=razorpay`).
 * Verifies the raw cryptographic signature and atomically confirms (or marks failed) the order
 * even if the customer closed their browser right after paying.
 */
export async function POST(request: Request) {
  await connection()

  const provider = resolveProvider(request)
  if (!provider) {
    return Response.json({ ok: false, error: "Unsupported payment provider" }, { status: 400 })
  }

  const serviceSupabase = getServiceRoleSupabase()
  if (!serviceSupabase) {
    return Response.json({ ok: false, error: "Service role key not configured" }, { status: 503 })
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > 262_144) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413 })
  }

  const rawBody = await request.text()
  if (rawBody.length > 262_144) {
    return Response.json({ ok: false, error: "Payload too large" }, { status: 413 })
  }
  const adapter = getGatewayAdapter(provider)
  const verified = await adapter.parseAndVerifyWebhook({ rawBody, headers: request.headers })
  if (!verified.ok) {
    return Response.json({ ok: false, error: verified.error }, { status: 401 })
  }

  if (verified.event === "paid") {
    const { error } = await serviceSupabase.rpc("confirm_gateway_payment", {
      p_code: verified.orderCode ?? "",
      p_gateway: provider,
      p_gateway_order_id: verified.gatewayOrderId,
      p_payment_reference: verified.paymentReference,
      p_amount: verified.amountInr,
      p_method: verified.method,
    })
    if (error) {
      if (error.message.includes("ORDER_NOT_FOUND") || error.message.includes("ALREADY_PAID")) {
        return Response.json({ ok: true, ignored: true })
      }
      return Response.json({ ok: false, error: "Could not record payment" }, { status: 500 })
    }
    revalidatePath("/account", "layout")
    revalidatePath("/admin", "layout")
    revalidatePath("/track")
  } else if (verified.event === "failed") {
    await serviceSupabase.rpc("record_gateway_failure", {
      p_code: verified.orderCode ?? "",
      p_gateway: provider,
      p_gateway_order_id: verified.gatewayOrderId ?? null,
      p_note: verified.reason ?? null,
    })
    revalidatePath("/account", "layout")
    revalidatePath("/admin", "layout")
    revalidatePath("/track")
  }

  return Response.json({ ok: true })
}

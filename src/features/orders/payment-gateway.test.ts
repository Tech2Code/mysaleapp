import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getGatewayAdapter, hmacSha256Hex, timingSafeHexEqual } from "./payment-gateway"

describe("payment-gateway crypto helpers", () => {
  it("computes deterministic HMAC-SHA256 hex digests and verifies with timingSafeHexEqual", () => {
    const sig = hmacSha256Hex("rzp_secret_test", "order_ABC123|pay_XYZ987")
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
    expect(timingSafeHexEqual(sig, sig)).toBe(true)
    expect(timingSafeHexEqual(sig, sig.toUpperCase())).toBe(true)
    expect(timingSafeHexEqual(sig, `${sig.slice(0, 63)}${sig.endsWith("a") ? "b" : "a"}`)).toBe(false)
    expect(timingSafeHexEqual(sig, "short")).toBe(false)
    expect(timingSafeHexEqual(sig, "z".repeat(64))).toBe(false)
  })
})

describe("razorpay gateway adapter", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_12345"
    process.env.RAZORPAY_KEY_SECRET = "rzp_secret_test_key"
    process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_webhook_secret_key"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_dummy"
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it("reports isConfigured accurately from env vars", () => {
    const adapter = getGatewayAdapter("razorpay")
    expect(adapter.isConfigured()).toBe(true)

    delete process.env.RAZORPAY_KEY_SECRET
    expect(adapter.isConfigured()).toBe(false)
  })

  it("verifyClientPayment rejects gatewayOrderId mismatch before hitting network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const adapter = getGatewayAdapter("razorpay")
    const res = await adapter.verifyClientPayment({
      expectedGatewayOrderId: "order_EXPECTED1",
      expectedAmountInr: 499,
      gatewayOrderId: "order_OTHER2",
      paymentId: "pay_12345678",
      signature: "0".repeat(64),
    })
    expect(res).toEqual({ ok: false, error: "Order reference mismatch." })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("verifyClientPayment rejects invalid HMAC signatures", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const adapter = getGatewayAdapter("razorpay")
    const res = await adapter.verifyClientPayment({
      expectedGatewayOrderId: "order_ABC123",
      expectedAmountInr: 499,
      gatewayOrderId: "order_ABC123",
      paymentId: "pay_12345678",
      signature: "a".repeat(64),
    })
    expect(res).toEqual({ ok: false, error: "Invalid payment signature." })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("verifyClientPayment confirms valid signature and captured payment amount/method", async () => {
    const signature = hmacSha256Hex("rzp_secret_test_key", "order_ABC123|pay_P9xK2mN8")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pay_P9xK2mN8",
          order_id: "order_ABC123",
          amount: 49900,
          currency: "INR",
          status: "captured",
          method: "upi",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const adapter = getGatewayAdapter("razorpay")
    const res = await adapter.verifyClientPayment({
      expectedGatewayOrderId: "order_ABC123",
      expectedAmountInr: 499,
      gatewayOrderId: "order_ABC123",
      paymentId: "pay_P9xK2mN8",
      signature,
    })
    expect(res).toEqual({ ok: true, paymentReference: "pay_P9xK2mN8", method: "upi" })
  })

  it("verifyClientPayment rejects amount mismatches returned by Razorpay API", async () => {
    const signature = hmacSha256Hex("rzp_secret_test_key", "order_ABC123|pay_P9xK2mN8")
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pay_P9xK2mN8",
          order_id: "order_ABC123",
          amount: 10000,
          currency: "INR",
          status: "captured",
          method: "card",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )

    const adapter = getGatewayAdapter("razorpay")
    const res = await adapter.verifyClientPayment({
      expectedGatewayOrderId: "order_ABC123",
      expectedAmountInr: 499,
      gatewayOrderId: "order_ABC123",
      paymentId: "pay_P9xK2mN8",
      signature,
    })
    expect(res).toEqual({ ok: false, error: "Payment is not captured for this order." })
  })

  it("parseAndVerifyWebhook verifies signature and maps payment.captured / payment.failed / ignored", async () => {
    const adapter = getGatewayAdapter("razorpay")

    const capturedBody = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_CAP12345",
            order_id: "order_GW999",
            amount: 125050,
            method: "netbanking",
            status: "captured",
            notes: { orderCode: "KK-AB12CD" },
          },
        },
      },
    })
    const capturedSig = hmacSha256Hex("rzp_webhook_secret_key", capturedBody)
    const okRes = await adapter.parseAndVerifyWebhook({
      rawBody: capturedBody,
      headers: new Headers({ "x-razorpay-signature": capturedSig }),
    })
    expect(okRes).toEqual({
      ok: true,
      event: "paid",
      orderCode: "KK-AB12CD",
      gatewayOrderId: "order_GW999",
      paymentReference: "pay_CAP12345",
      amountInr: 1250.5,
      method: "bank_transfer",
    })

    const badSig = await adapter.parseAndVerifyWebhook({
      rawBody: capturedBody,
      headers: new Headers({ "x-razorpay-signature": "f".repeat(64) }),
    })
    expect(badSig).toEqual({ ok: false, error: "Invalid webhook signature." })

    const failedBody = JSON.stringify({
      event: "payment.failed",
      payload: {
        payment: {
          entity: {
            order_id: "order_GW999",
            error_description: "Bank declined transaction",
            notes: { orderCode: "KK-AB12CD" },
          },
        },
      },
    })
    const failedSig = hmacSha256Hex("rzp_webhook_secret_key", failedBody)
    const failRes = await adapter.parseAndVerifyWebhook({
      rawBody: failedBody,
      headers: new Headers({ "x-razorpay-signature": failedSig }),
    })
    expect(failRes).toEqual({
      ok: true,
      event: "failed",
      orderCode: "KK-AB12CD",
      gatewayOrderId: "order_GW999",
      reason: "Bank declined transaction",
    })
  })
})

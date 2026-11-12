import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, type Call, type Result } from "../../../test/fake-supabase"

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  limited: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
  config: { isSupabaseConfigured: true },
}))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return mocks.config.isSupabaseConfigured
  },
}))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }))
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/features/security/rate-limit", () => ({ RATE_LIMIT_MESSAGE: "Too many attempts.", limited: mocks.limited }))
vi.mock("@/features/addresses/server", () => ({ addAddressFromOrder: vi.fn() }))
vi.mock("@/features/products/queries", () => ({ CACHE_TAGS: { products: "products" }, getActiveProducts: vi.fn(async () => []) }))
vi.mock("@/features/settings/queries", async () => {
  const { DEFAULT_SETTINGS } = await import("@/features/settings/defaults")
  return { getStoreSettings: vi.fn(async () => DEFAULT_SETTINGS) }
})

import { cancelOrder, placeOrder, requestReturn, submitPayment, trackOrder, updateOrderDelivery, withdrawReturnRequest } from "./actions"

const ID = "11111111-1111-4111-8111-111111111111"
const customer = { name: "AUDIT TEST", phone: "9876543210", address: "12 Test Street, Some Area", city: "Mumbai", state: "Maharashtra", pincode: "400001" }
const order = { customer, items: [{ productId: ID, quantity: 2 }], paymentReference: "123456789012" }
const code = "KK-ABC123"

function setup(rpc: Result = { data: null }) {
  const fake = fakeSupabase((call: Call) => (call.kind === "rpc" ? rpc : { data: null }))
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}
const rpcNames = (calls: Call[]) => calls.filter((c) => c.kind === "rpc").map((c) => c.name)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.limited.mockResolvedValue(false)
  mocks.config.isSupabaseConfigured = true
})

describe("validation failures return field errors and never reach the limiter or the database", () => {
  it.each([
    ["placeOrder", () => placeOrder({ customer: { ...customer, pincode: "12" }, items: [] })],
    ["trackOrder", () => trackOrder({ code: "x", phoneLast4: "1" })],
    ["submitPayment", () => submitPayment({ code, phoneLast4: "1234", reference: "abc" })],
    ["updateOrderDelivery", () => updateOrderDelivery({ code, customer: { ...customer, name: "" } })],
    ["cancelOrder", () => cancelOrder({ code, reason: "Other" })],
    ["requestReturn", () => requestReturn({ code, items: [], reason: "Damaged" })],
  ])("%s", async (_n, run) => {
    const fake = setup()
    const r = await run()
    expect(r.ok).toBe(false)
    expect(!r.ok && Object.keys(r.fieldErrors ?? {}).length).toBeGreaterThan(0)
    expect(mocks.limited).not.toHaveBeenCalled()
    expect(fake.calls).toHaveLength(0)
  })
})

describe("the rate limiter runs before the RPC", () => {
  const cases: [string, string, () => Promise<{ ok: boolean }>][] = [
    ["placeOrder", "place-order", () => placeOrder(order)],
    ["trackOrder", "track-order", () => trackOrder({ code, phoneLast4: "1234" })],
    ["submitPayment", "submit-payment", () => submitPayment({ code, phoneLast4: "1234", reference: "123456789012" })],
    ["updateOrderDelivery", "update-delivery", () => updateOrderDelivery({ code, phoneLast4: "1234", customer })],
    ["cancelOrder", "cancel-order", () => cancelOrder({ code, phoneLast4: "1234", reason: "Changed my mind" })],
    ["requestReturn", "request-return", () => requestReturn({ code, phoneLast4: "1234", items: [{ productId: ID, quantity: 1 }], reason: "Damaged", details: "Arrived cracked" })],
    ["withdrawReturnRequest", "withdraw-return", () => withdrawReturnRequest({ code, phoneLast4: "1234", requestId: ID })],
  ]
  it.each(cases)("%s uses scope %s and stops when limited", async (_n, scope, run) => {
    mocks.limited.mockResolvedValue(true)
    const fake = setup()
    const r = await run()
    expect(r).toMatchObject({ ok: false, error: "Too many attempts." })
    expect(mocks.limited).toHaveBeenCalledWith(scope)
    expect(rpcNames(fake.calls)).toEqual([])
  })

  it.each(cases)("%s asks the limiter first, then calls the RPC", async (_n, _s, run) => {
    const seen: string[] = []
    mocks.limited.mockImplementation(async () => (seen.push("limiter"), false))
    const fake = fakeSupabase((call) => (seen.push(`${call.kind}:${call.name}`), { data: null }))
    mocks.getServerSupabase.mockResolvedValue(fake.client)
    await run()
    expect(seen[0]).toBe("limiter")
  })

  it("demo mode is refused before the limiter", async () => {
    mocks.config.isSupabaseConfigured = false
    setup()
    expect(await placeOrder(order)).toMatchObject({ ok: false })
    expect(mocks.limited).not.toHaveBeenCalled()
  })
})

describe("placeOrder", () => {
  const row = { order_code: code, subtotal: "400", shipping_fee: "50", shipping_fee_original: "50", extra_fees: null, total: "450" }

  it("sends the joined 'City, State' and a normalised phone; numbers come from the DB row", async () => {
    const fake = setup({ data: row })
    const r = await placeOrder(order)
    expect(r).toMatchObject({ ok: true, data: { orderCode: code, total: 450, phoneLast4: "3210" } })
    const args = fake.calls.find((c) => c.name === "create_order")!.args as { p_customer: Record<string, unknown>; p_items: unknown }
    expect(args.p_customer).toMatchObject({ city: "Mumbai, Maharashtra", phone: "9876543210" })
    expect(args.p_customer).not.toHaveProperty("state")
    expect(args.p_items).toEqual(order.items)
    expect(mocks.updateTag).toHaveBeenCalledWith("products")
  })

  it.each([
    ["ITEM_UNAVAILABLE", /out of stock/],
    ["TOO_MANY_ORDERS", /Too many unpaid orders/],
    ["INVALID_PINCODE", /pincode/],
  ])("RPC error %s is mapped", async (codeName, re) => {
    setup({ error: { message: `P0001 ${codeName}` } })
    const r = await placeOrder(order)
    expect(!r.ok && r.error).toMatch(re)
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("an unknown RPC error gets the generic message", async () => {
    setup({ error: { message: "kaboom" } })
    expect(await placeOrder(order)).toMatchObject({ ok: false, error: "Could not place your order. Please try again." })
  })
})

describe("guest RPCs that answer {error} instead of raising", () => {
  it("trackOrder maps TOO_MANY_ATTEMPTS", async () => {
    setup({ data: { ok: false, error: "TOO_MANY_ATTEMPTS" } })
    expect(await trackOrder({ code, phoneLast4: "1234" })).toMatchObject({ ok: false, error: expect.stringContaining("Too many wrong attempts") })
  })
  it("trackOrder with no data says not found", async () => {
    setup({ data: null })
    expect(await trackOrder({ code, phoneLast4: "1234" })).toMatchObject({ ok: false, error: "No order found with that code and phone number." })
  })
  it("an unknown soft error falls back to a generic message", async () => {
    setup({ data: { ok: false, error: "???" } })
    expect(await submitPayment({ code, phoneLast4: "1234", reference: "123456789012" })).toMatchObject({ ok: false, error: "Could not find that order." })
  })
  it("cancelOrder reports refundDue only when the RPC says so, and refreshes the catalogue", async () => {
    setup({ data: { refundDue: true } })
    expect(await cancelOrder({ code, phoneLast4: "1234", reason: "Changed my mind" })).toEqual({ ok: true, data: { refundDue: true } })
    expect(mocks.updateTag).toHaveBeenCalledWith("products")
    setup({ data: { refundDue: "yes" } })
    expect(await cancelOrder({ code, phoneLast4: "1234", reason: "Changed my mind" })).toEqual({ ok: true, data: { refundDue: false } })
  })
  it("cancelOrder sends the combined reason text", async () => {
    const fake = setup({ data: {} })
    await cancelOrder({ code, phoneLast4: "1234", reason: "Other", detail: "Found it cheaper" })
    expect(fake.calls[0].args).toMatchObject({ p_reason: "Found it cheaper", p_phone_last4: "1234" })
  })
  it("updateOrderDelivery falls back to the phone's last 4 digits", async () => {
    setup({ data: {} })
    expect(await updateOrderDelivery({ code, phoneLast4: "1234", customer })).toEqual({ ok: true, data: { phoneLast4: "3210" } })
  })
  it("withdrawReturnRequest normalises and forwards p_phone for guests", async () => {
    const fake = setup({ data: { ok: true } })
    expect(await withdrawReturnRequest({ code, phoneLast4: "3210", phone: "+91 98765 43210", requestId: ID })).toEqual({ ok: true })
    expect(fake.calls[0].args).toMatchObject({ p_code: code, p_phone_last4: "3210", p_phone: "9876543210", p_request_id: ID })
  })
})

describe("trackOrder result shaping", () => {
  it("fills defaults and converts numeric strings", async () => {
    setup({
      data: {
        code,
        status: "pending",
        history: [],
        items: [{ productId: ID, name: "Lamp", slug: "lamp", price: "199.50", quantity: 1, image: null }],
        subtotal: "199.50",
        total: "249.50",
        shippingFee: "50",
      },
    })
    const r = await trackOrder({ code, phoneLast4: "1234" })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.items[0].price).toBe(199.5)
    expect(r.data.total).toBe(249.5)
    expect(r.data).toMatchObject({ shipping: null, cancellation: null, returns: [], returnRequests: [], paymentStatus: "pending" })
    expect(r.data.returnWindow).toMatchObject({ open: false })
  })
})

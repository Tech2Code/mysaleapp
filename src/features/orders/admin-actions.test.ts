import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, has, type Call, type Result } from "../../../test/fake-supabase"

const mocks = vi.hoisted(() => ({
  getServerSupabase: vi.fn(),
  assertAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/features/auth/guards", () => ({ assertAdmin: mocks.assertAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath, updateTag: mocks.updateTag }))
vi.mock("@/features/products/queries", () => ({ CACHE_TAGS: { products: "products" } }))

import { cancelOrderAsAdmin, decideReturnRequest, recordOrderReturn, updateOrderPayment, updateOrderStatus } from "./admin-actions"

const ID = "11111111-1111-4111-8111-111111111111"
/** What the admin form sends: blank strings for untouched fields. */
const BLANK = { method: "", reference: "", amount: "", note: "" }
const STALE = "This order was just changed by someone else. Refresh the page and try again."

type Order = Record<string, unknown>
/** Reads of `orders` return `order`, updates return `opts.updated`, RPCs return `opts.rpc`. */
function setup(order: Order | null, opts: { updated?: Result; rpc?: Result } = {}) {
  const fake = fakeSupabase((call: Call) => {
    if (call.kind === "rpc") return opts.rpc ?? { data: null }
    if (call.ops.some(([m]) => m === "update")) return opts.updated ?? { data: [{ id: ID }] }
    return { data: order }
  })
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}
const rpcCall = (calls: Call[], name: string) => calls.find((c) => c.kind === "rpc" && c.name === name)
const updateCall = (calls: Call[]) => calls.find((c) => c.ops.some(([m]) => m === "update"))
const updatePayload = (c: Call) => c.ops.find(([m]) => m === "update")![1][0]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAdmin.mockResolvedValue({ ok: true, user: { id: "admin" } })
})

describe("admin guard", () => {
  it("every action refuses a non-admin before touching the database", async () => {
    mocks.assertAdmin.mockResolvedValue({ ok: false, error: "Not authorised" })
    const fake = setup(null)
    const results = await Promise.all([
      updateOrderStatus({ orderId: ID, status: "confirmed" }),
      updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" }),
      cancelOrderAsAdmin({ orderId: ID, reason: "Item out of stock" }),
      recordOrderReturn({}),
      decideReturnRequest({}),
    ])
    for (const r of results) expect(r).toMatchObject({ ok: false, error: "Not authorised" })
    expect(fake.calls).toHaveLength(0)
  })
})

describe("updateOrderStatus compare-and-set", () => {
  const order = { status: "confirmed", payment_status: "paid", shipping_carrier: null }

  it("validation failure returns field errors", async () => {
    setup(order)
    const r = await updateOrderStatus({ orderId: "nope", status: "packed" })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.fieldErrors?.orderId).toBeTruthy()
  })

  it("order missing -> not found", async () => {
    setup(null)
    expect(await updateOrderStatus({ orderId: ID, status: "packed" })).toMatchObject({ ok: false, error: "Order not found" })
  })

  it("stale expectedStatus -> friendly error and no update", async () => {
    const { calls } = setup(order)
    const r = await updateOrderStatus({ orderId: ID, status: "packed", expectedStatus: "pending" })
    expect(r).toMatchObject({ ok: false, error: STALE })
    expect(updateCall(calls)).toBeUndefined()
  })

  it("the update is guarded by the status that was read", async () => {
    const { calls } = setup(order)
    expect(await updateOrderStatus({ orderId: ID, status: "packed", expectedStatus: "confirmed" })).toEqual({ ok: true })
    const u = updateCall(calls)!
    expect(has(u, "eq", "id", ID)).toBe(true)
    expect(has(u, "eq", "status", "confirmed")).toBe(true)
    expect(mocks.revalidatePath).toHaveBeenCalled()
  })

  it("0 rows updated -> friendly error, no revalidation", async () => {
    setup(order, { updated: { data: [] } })
    expect(await updateOrderStatus({ orderId: ID, status: "packed" })).toMatchObject({ ok: false, error: STALE })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("database error -> generic failure", async () => {
    setup(order, { updated: { error: { message: "boom" } } })
    expect(await updateOrderStatus({ orderId: ID, status: "packed" })).toMatchObject({ ok: false, error: "Could not update status" })
  })

  it("an illegal move (shipped without courier) is refused and nothing is written", async () => {
    const { calls } = setup({ ...order, status: "packed" })
    expect((await updateOrderStatus({ orderId: ID, status: "shipped" })).ok).toBe(false)
    expect(updateCall(calls)).toBeUndefined()
  })
})

describe("updateOrderPayment refunds", () => {
  const paid = { status: "cancelled", total: "1000", payment_status: "paid", payment_amount: "1000", refunded_amount: "300", payment_reference: "123456789012" }
  const refund = (extra: Record<string, unknown> = {}) =>
    updateOrderPayment({ orderId: ID, ...BLANK, status: "refunded", reference: "999999999999", amount: 700, note: "Cancelled order refund", ...extra })
  const arg = (calls: Call[], key: string) => (rpcCall(calls, "refund_order")!.args as Record<string, unknown>)[key]

  it("full remaining amount is sent as p_amount null with the status that was read", async () => {
    const { calls } = setup(paid)
    expect(await refund()).toEqual({ ok: true, data: { confirmed: false } })
    expect(rpcCall(calls, "refund_order")!.args).toMatchObject({
      p_order_id: ID,
      p_amount: null,
      p_expected_status: "cancelled",
      p_reference: "999999999999",
      p_note: "Cancelled order refund",
    })
  })

  it("an amount equal to what is left is sent as a full refund", async () => {
    const { calls } = setup(paid)
    await refund({ amount: 700 })
    expect(arg(calls, "p_amount")).toBeNull()
  })

  it("a partial amount is passed through", async () => {
    const { calls } = setup(paid)
    await refund({ amount: 200, note: "damaged" })
    expect(rpcCall(calls, "refund_order")!.args).toMatchObject({ p_amount: 200, p_note: "damaged" })
  })

  it("more than what is left is refused and no RPC is made", async () => {
    const { calls } = setup(paid)
    expect(await refund({ amount: 700.5 })).toMatchObject({ ok: false, error: "You can refund at most ₹700.00." })
    expect(rpcCall(calls, "refund_order")).toBeUndefined()
  })

  it("amount 0 is refused", async () => {
    const { calls } = setup(paid)
    expect(await refund({ amount: 0 })).toMatchObject({ ok: false })
    expect(rpcCall(calls, "refund_order")).toBeUndefined()
  })

  it("the customer's incoming payment UTR is refused as a refund reference; a different one is kept", async () => {
    let s = setup(paid)
    expect(await refund({ reference: "123456789012" })).toMatchObject({
      ok: false,
      error: "Enter your refund UTR, not the customer's incoming payment UTR.",
    })
    expect(rpcCall(s.calls, "refund_order")).toBeUndefined()
    s = setup(paid)
    await refund({ reference: "999999999999" })
    expect(arg(s.calls, "p_reference")).toBe("999999999999")
  })

  it("falls back to the order total when no payment amount was recorded", async () => {
    const { calls } = setup({ ...paid, payment_amount: null, refunded_amount: null })
    await refund({ amount: 1000 })
    expect(arg(calls, "p_amount")).toBeNull()
    expect(await refund({ amount: 1000.5 })).toMatchObject({ ok: false })
  })

  it.each([
    ["ORDER_CHANGED", STALE],
    ["NOT_PAID", STALE],
    ["BAD_AMOUNT", "That refund amount is not valid for this order."],
    ["something else", "Could not record the refund"],
  ])("RPC error %s -> friendly message", async (code, message) => {
    setup(paid, { rpc: { error: { message: `raise ${code}` } } })
    expect(await refund()).toMatchObject({ ok: false, error: message })
  })

  it("only a paid order can be refunded", async () => {
    const { calls } = setup({ ...paid, payment_status: "pending" })
    expect(await refund()).toMatchObject({ ok: false, error: "Only a paid, cancelled order can be refunded." })
    expect(rpcCall(calls, "refund_order")).toBeUndefined()
  })
})

describe("updateOrderPayment non-refund paths", () => {
  const pending = { status: "pending", total: "500", payment_status: "submitted", payment_amount: null, refunded_amount: 0, payment_reference: null }

  it("marking paid confirms a pending order, defaults the amount to the total, and is guarded by status", async () => {
    const { calls } = setup(pending)
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" })).toEqual({ ok: true, data: { confirmed: true } })
    const u = updateCall(calls)!
    expect(has(u, "eq", "status", "pending")).toBe(true)
    expect(updatePayload(u)).toMatchObject({ payment_status: "paid", payment_amount: 500, status: "confirmed", payment_method: "upi" })
  })

  it("0 rows updated -> friendly error", async () => {
    setup(pending, { updated: { data: [] } })
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" })).toMatchObject({ ok: false, error: STALE })
  })

  it("duplicate UTR (23505) -> friendly message", async () => {
    setup(pending, { updated: { error: { message: "dup", code: "23505" } } })
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", reference: "123456789012" })).toMatchObject({
      ok: false,
      error: "This reference number is already attached to another order.",
    })
  })

  it("a cancelled order with no payment sent cannot be marked paid", async () => {
    const { calls } = setup({ ...pending, status: "cancelled", payment_status: "pending" })
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" })).toMatchObject({ ok: false })
    expect(updateCall(calls)).toBeUndefined()
  })

  it("a payment submitted before the order was cancelled can be confirmed, so the refund can be recorded", async () => {
    const { calls } = setup({ ...pending, status: "cancelled" })
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" })).toMatchObject({ ok: true })
    expect(updateCall(calls)).toBeDefined()
  })

  it("invalid input returns field errors", async () => {
    setup(pending)
    const r = await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", amount: -5 })
    expect(!r.ok && r.fieldErrors?.amount).toBeTruthy()
  })
})

describe("cancelOrderAsAdmin", () => {
  it("'Other' without detail is a field error", async () => {
    setup({ status: "confirmed" })
    const r = await cancelOrderAsAdmin({ orderId: ID, reason: "Other" })
    expect(!r.ok && r.fieldErrors?.detail).toBeTruthy()
  })

  it.each(["shipped", "delivered", "cancelled"])("a %s order is refused and not updated", async (status) => {
    const { calls } = setup({ status })
    expect(await cancelOrderAsAdmin({ orderId: ID, reason: "Item out of stock" })).toMatchObject({ ok: false })
    expect(updateCall(calls)).toBeUndefined()
  })

  it("cancels with by=admin, guarded by the status read, and busts the product cache", async () => {
    const { calls } = setup({ status: "confirmed" })
    expect(await cancelOrderAsAdmin({ orderId: ID, reason: "Item out of stock", detail: "sorry" })).toEqual({ ok: true })
    const u = updateCall(calls)!
    expect(has(u, "eq", "status", "confirmed")).toBe(true)
    expect(updatePayload(u)).toMatchObject({ status: "cancelled", cancelled_by: "admin", cancel_reason: "Item out of stock: sorry" })
    expect(mocks.updateTag).toHaveBeenCalledWith("products")
  })

  it("0 rows updated -> friendly error and no cache bust", async () => {
    setup({ status: "confirmed" }, { updated: { data: [] } })
    expect(await cancelOrderAsAdmin({ orderId: ID, reason: "Item out of stock" })).toMatchObject({ ok: false, error: STALE })
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })
})

describe("recordOrderReturn / decideReturnRequest", () => {
  const items = [{ productId: ID, name: "Lamp", quantity: 1, restock: true }]
  const reason = "Damaged in transit"

  it("passes args to the RPC, sends p_request_id only when given, and normalises the result", async () => {
    let s = setup(null, { rpc: { data: { restocked: "2", refundedAmount: "150.5", fullyRefunded: true } } })
    expect(await recordOrderReturn({ orderId: ID, items, reason, refund: true })).toEqual({
      ok: true,
      data: { restocked: 2, refundedAmount: 150.5, fullyRefunded: true },
    })
    expect(rpcCall(s.calls, "record_order_return")!.args).toEqual({ p_order_id: ID, p_items: items, p_reason: reason, p_refund: true })
    s = setup(null)
    await recordOrderReturn({ orderId: ID, items, reason, refund: false, requestId: ID })
    expect(rpcCall(s.calls, "record_order_return")!.args).toMatchObject({ p_request_id: ID })
  })

  it("empty items -> field errors, no RPC", async () => {
    const { calls } = setup(null)
    const r = await recordOrderReturn({ orderId: ID, items: [], reason, refund: false })
    expect(!r.ok && r.fieldErrors?.items).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  it("maps RPC error codes", async () => {
    setup(null, { rpc: { error: { message: "TOO_MANY_RETURNED" } } })
    expect(await recordOrderReturn({ orderId: ID, items, reason, refund: false })).toMatchObject({ error: "You can't return more than you ordered." })
  })

  it("rejecting needs a reason; NOT_PENDING is friendly", async () => {
    const { calls } = setup(null)
    expect(await decideReturnRequest({ requestId: ID, approve: false })).toMatchObject({ ok: false, fieldErrors: { note: ["Write a reason"] } })
    expect(calls).toHaveLength(0)
    expect(await decideReturnRequest({ requestId: ID, approve: true })).toMatchObject({ ok: false, fieldErrors: { pickupDate: ["Pick the pickup date"] } })
    expect(calls).toHaveLength(0)
    setup(null, { rpc: { error: { message: "NOT_PENDING" } } })
    expect(await decideReturnRequest({ requestId: ID, approve: true, pickupDate: "2026-11-20" })).toMatchObject({ error: "This request was already decided or withdrawn." })
  })
})

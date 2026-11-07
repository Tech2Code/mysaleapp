import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, type Call, type Result } from "../../../test/fake-supabase"

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn(), assertAdmin: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/features/auth/guards", () => ({ assertAdmin: mocks.assertAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock("@/features/products/queries", () => ({ CACHE_TAGS: { products: "products" } }))

import { refundReturn, updateOrderPayment } from "./admin-actions"

const ID = "11111111-1111-4111-8111-111111111111"
const BLANK = { method: "", reference: "", amount: "", note: "" }

function setup(order: Record<string, unknown>, rpc: Result = { data: { refundedAmount: 300, fullyRefunded: false } }) {
  const fake = fakeSupabase((call: Call) => {
    if (call.kind === "rpc") return rpc
    if (call.ops.some(([m]) => m === "update")) return { data: [{ id: ID }] }
    return { data: order }
  })
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}
const wrote = (calls: Call[]) => calls.some((c) => c.ops.some(([m]) => m === "update")) || calls.some((c) => c.kind === "rpc")
const updatePayload = (calls: Call[]) =>
  calls.find((c) => c.ops.some(([m]) => m === "update"))!.ops.find(([m]) => m === "update")![1][0] as Record<string, unknown>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAdmin.mockResolvedValue({ ok: true, user: { id: "admin" } })
})

describe("updateOrderPayment never moves a paid / refunded payment back", () => {
  const paid = (status: string) => ({ status, total: "500", payment_status: "paid", payment_amount: "500", refunded_amount: 0, payment_reference: "123456789012" })

  for (const status of ["confirmed", "shipped", "delivered", "cancelled"]) {
    for (const next of ["pending", "submitted", "failed"]) {
      it(`${status} + paid -> ${next} is refused and nothing is written`, async () => {
        const { calls } = setup(paid(status))
        const r = await updateOrderPayment({ orderId: ID, ...BLANK, status: next })
        expect(r.ok).toBe(false)
        expect(wrote(calls)).toBe(false)
      })
    }
  }

  it("a refunded payment is terminal", async () => {
    const { calls } = setup({ ...paid("delivered"), payment_status: "refunded" })
    const r = await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid" })
    expect(r).toMatchObject({ ok: false })
    expect(wrote(calls)).toBe(false)
  })

  it("delivered + paid: changing the amount or UTR is refused", async () => {
    const a = setup(paid("delivered"))
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", amount: "400", reference: "123456789012" })).toMatchObject({ ok: false })
    expect(wrote(a.calls)).toBe(false)
    const b = setup(paid("delivered"))
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", amount: "500", reference: "NEW" })).toMatchObject({ ok: false })
    expect(wrote(b.calls)).toBe(false)
  })

  it("delivered + paid: a note-only save writes only method, note and status (never amount / reference / paid time)", async () => {
    const { calls } = setup(paid("delivered"))
    const r = await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", amount: "500", reference: "123456789012", note: "Thanks" })
    expect(r).toMatchObject({ ok: true })
    expect(Object.keys(updatePayload(calls)).sort()).toEqual(["payment_method", "payment_note", "payment_status"])
  })

  it("an in-progress paid order may still have its amount corrected", async () => {
    const { calls } = setup(paid("confirmed"))
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "paid", amount: "450", reference: "123456789012" })).toMatchObject({ ok: true })
    expect(updatePayload(calls).payment_amount).toBe(450)
  })

  it("paid -> refunded still goes through refund_order", async () => {
    const { calls } = setup(paid("delivered"), { data: { ok: true } })
    expect(await updateOrderPayment({ orderId: ID, ...BLANK, status: "refunded" })).toMatchObject({ ok: true })
    expect(calls.some((c) => c.kind === "rpc" && c.name === "refund_order")).toBe(true)
  })
})

describe("refundReturn", () => {
  const RID = "22222222-2222-4222-8222-222222222222"

  it("is admin only and validates the id", async () => {
    mocks.assertAdmin.mockResolvedValue({ ok: false, error: "Not authorised" })
    const fake = setup({})
    expect(await refundReturn({ returnId: RID })).toMatchObject({ ok: false, error: "Not authorised" })
    expect(fake.calls).toHaveLength(0)
    mocks.assertAdmin.mockResolvedValue({ ok: true, user: { id: "admin" } })
    expect(await refundReturn({ returnId: "nope" })).toMatchObject({ ok: false })
  })

  it("calls refund_return with the idempotency guard and returns the result", async () => {
    const { calls } = setup({})
    const r = await refundReturn({ returnId: RID, expectedRefunded: 100 })
    expect(r).toEqual({ ok: true, data: { refundedAmount: 300, fullyRefunded: false } })
    expect(calls[0]).toMatchObject({ kind: "rpc", name: "refund_return", args: { p_return_id: RID, p_expected_refunded: 100 } })
  })

  it("maps database errors to friendly messages", async () => {
    setup({}, { error: { message: "ALREADY_REFUNDED" } })
    expect(await refundReturn({ returnId: RID })).toMatchObject({ ok: false, error: "This return was already refunded." })
  })
})

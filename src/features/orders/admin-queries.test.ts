import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, has, type Call } from "../../../test/fake-supabase"
import { ORDER_VIEWS, isOrderView } from "./views"

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/features/auth/guards", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin" })) }))

import { listOrders } from "./admin-queries"

const NONE = "00000000-0000-0000-0000-000000000000"

function setup(pendingRequestOrderIds: string[] = []) {
  const fake = fakeSupabase((call: Call) => {
    if (call.name === "return_requests") return { data: pendingRequestOrderIds.map((order_id) => ({ order_id })) }
    return { data: [], count: 0 }
  })
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}
const ordersCall = (calls: Call[]) => calls.find((c) => c.name === "orders")!

describe("order views (dashboard tile and list share one filter)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("every declared view is recognised, nothing else is", () => {
    for (const v of Object.keys(ORDER_VIEWS)) expect(isOrderView(v)).toBe(true)
    expect(isOrderView("nope")).toBe(false)
    expect(isOrderView(undefined)).toBe(false)
  })

  it("to-verify: payment submitted, not cancelled", async () => {
    const { calls } = setup()
    await listOrders({ view: "to-verify" })
    const c = ordersCall(calls)
    expect(has(c, "eq", "payment_status", "submitted")).toBe(true)
    expect(has(c, "neq", "status", "cancelled")).toBe(true)
  })

  it("awaiting-payment: pending order with payment pending/failed (twin of isAwaitingPayment)", async () => {
    const { calls } = setup()
    await listOrders({ view: "awaiting-payment" })
    const c = ordersCall(calls)
    expect(has(c, "eq", "status", "pending")).toBe(true)
    expect(has(c, "in", "payment_status", ["pending", "failed"])).toBe(true)
  })

  it("to-ship: confirmed or packed", async () => {
    const { calls } = setup()
    await listOrders({ view: "to-ship" })
    expect(has(ordersCall(calls), "in", "status", ["confirmed", "packed"])).toBe(true)
  })

  it("return-requests: looks up only 'requested' rows and filters orders to those ids", async () => {
    const { calls } = setup(["a", "b"])
    await listOrders({ view: "return-requests" })
    const rr = calls.find((c) => c.name === "return_requests")!
    expect(has(rr, "eq", "status", "requested")).toBe(true)
    expect(has(ordersCall(calls), "in", "id", ["a", "b"])).toBe(true)
  })

  it("return-requests with none waiting matches nothing (impossible id), not everything", async () => {
    const { calls } = setup([])
    await listOrders({ view: "return-requests" })
    expect(has(ordersCall(calls), "in", "id", [NONE])).toBe(true)
  })

  it("a view replaces the status/payment filters; without a view they apply", async () => {
    let s = setup()
    await listOrders({ view: "to-ship", status: "delivered", payment: "paid" })
    expect(has(ordersCall(s.calls), "eq", "status", "delivered")).toBe(false)
    s = setup()
    await listOrders({ status: "delivered", payment: "pending" })
    const c = ordersCall(s.calls)
    expect(has(c, "eq", "status", "delivered")).toBe(true)
    expect(has(c, "eq", "payment_status", "pending")).toBe(true)
    expect(has(c, "neq", "status", "cancelled")).toBe(true)
  })

  it("an unknown view is ignored", async () => {
    const { calls } = setup()
    await listOrders({ view: "bogus" })
    expect(calls.some((c) => c.name === "return_requests")).toBe(false)
  })

  it("search strips PostgREST filter syntax characters", async () => {
    const { calls } = setup()
    await listOrders({ q: "a,b).or(x.eq.1" })
    const or = ordersCall(calls).ops.find(([m]) => m === "or")![1][0] as string
    expect(or).toBe("order_code.ilike.%aborxeq1%,phone.ilike.%aborxeq1%,customer_name.ilike.%aborxeq1%")
  })

  it("payment filter: refund-due finds cancelled orders with paid/submitted payment, and paid/submitted do not hide cancelled orders", async () => {
    let s = setup()
    await listOrders({ payment: "refund-due" })
    let c = ordersCall(s.calls)
    expect(has(c, "eq", "status", "cancelled")).toBe(true)
    expect(has(c, "in", "payment_status", ["paid", "submitted"])).toBe(true)

    s = setup()
    await listOrders({ payment: "paid" })
    c = ordersCall(s.calls)
    expect(has(c, "eq", "payment_status", "paid")).toBe(true)
    expect(has(c, "neq", "status", "cancelled")).toBe(false)
  })
})

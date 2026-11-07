import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, has, type Call } from "../../../test/fake-supabase"

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/features/auth/guards", () => ({ requireAdmin: vi.fn(async () => ({ id: "admin" })) }))

import { getReturnViewCounts, listOrders, RETURN_VIEW_ID_LIMIT } from "./admin-queries"
import { ORDER_VIEWS, RETURN_VIEWS } from "./views"

const NONE = "00000000-0000-0000-0000-000000000000"

function setup(returnOrderIds: string[] = [], requestOrderIds: string[] = []) {
  const fake = fakeSupabase((call: Call) => {
    if (call.name === "order_returns") return { data: returnOrderIds.map((order_id) => ({ order_id })) }
    if (call.name === "return_requests") return { data: requestOrderIds.map((order_id) => ({ order_id })) }
    return { data: [], count: 3 }
  })
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}
const ordersCall = (calls: Call[]) => calls.find((c) => c.name === "orders")!

describe("return views", () => {
  beforeEach(() => vi.clearAllMocks())

  it("every return chip is a declared view", () => {
    for (const v of RETURN_VIEWS) expect(ORDER_VIEWS[v].label).toBeTruthy()
    expect(RETURN_VIEWS).toEqual(["return-requests", "returns-to-receive", "return-refund-pending", "returns-refunded"])
  })

  it("return-refund-pending: returns WITHOUT a refund, order still paid", async () => {
    const { calls } = setup(["a", "a", "b"])
    await listOrders({ view: "return-refund-pending" })
    const rr = calls.find((c) => c.name === "order_returns")!
    expect(has(rr, "eq", "refunded", false)).toBe(true)
    expect(has(rr, "limit", RETURN_VIEW_ID_LIMIT)).toBe(true)
    const o = ordersCall(calls)
    expect(has(o, "in", "id", ["a", "b"])).toBe(true) // de-duplicated
    expect(has(o, "eq", "payment_status", "paid")).toBe(true)
  })

  it("returns-refunded: returns WITH a refund, any payment state", async () => {
    const { calls } = setup(["x"])
    await listOrders({ view: "returns-refunded" })
    expect(has(calls.find((c) => c.name === "order_returns")!, "eq", "refunded", true)).toBe(true)
    const o = ordersCall(calls)
    expect(has(o, "in", "id", ["x"])).toBe(true)
    expect(o.ops.some(([m, a]) => m === "eq" && a[0] === "payment_status")).toBe(false)
  })

  it("no matching returns matches nothing, not everything", async () => {
    const { calls } = setup([])
    await listOrders({ view: "returns-refunded" })
    expect(has(ordersCall(calls), "in", "id", [NONE])).toBe(true)
  })

  it("chip counts use the same filters as the lists", async () => {
    const { calls } = setup(["a"], ["r"])
    const counts = await getReturnViewCounts()
    expect(counts).toEqual({ "return-requests": 3, "returns-to-receive": 3, "return-refund-pending": 3, "returns-refunded": 3 })
    const countCalls = calls.filter((c) => c.name === "orders")
    expect(countCalls).toHaveLength(4)
    expect(countCalls.every((c) => has(c, "in", "id"))).toBe(true)
    expect(countCalls.some((c) => has(c, "eq", "payment_status", "paid"))).toBe(true)
  })
})

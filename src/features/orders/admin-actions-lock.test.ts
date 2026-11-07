import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeSupabase, type Call } from "../../../test/fake-supabase"

const mocks = vi.hoisted(() => ({ getServerSupabase: vi.fn(), assertAdmin: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ getServerSupabase: mocks.getServerSupabase }))
vi.mock("@/features/auth/guards", () => ({ assertAdmin: mocks.assertAdmin }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock("@/features/products/queries", () => ({ CACHE_TAGS: { products: "products" } }))

import { updateOrderStatus } from "./admin-actions"

const ID = "11111111-1111-4111-8111-111111111111"
const SHIPPING = { carrier: "Delhivery", trackingNumber: "AWB1", trackingUrl: "", expectedDelivery: "" }

function setup(status: string) {
  const fake = fakeSupabase((call: Call) => {
    if (call.ops.some(([m]) => m === "update")) return { data: [{ id: ID }] }
    return { data: { status, payment_status: "paid", shipping_carrier: "Delhivery" } }
  })
  mocks.getServerSupabase.mockResolvedValue(fake.client)
  return fake
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAdmin.mockResolvedValue({ ok: true, user: { id: "admin" } })
})

describe("updateOrderStatus on a finished order", () => {
  for (const status of ["delivered", "cancelled"]) {
    it(`refuses shipping edits on a ${status} order and never writes`, async () => {
      const fake = setup(status)
      const r = await updateOrderStatus({ orderId: ID, status: status as "delivered", shipping: SHIPPING })
      expect(r).toMatchObject({ ok: false })
      expect(!r.ok && r.error).toMatch(/locked/i)
      expect(fake.calls.some((c) => c.ops.some(([m]) => m === "update"))).toBe(false)
    })
  }

  it("still lets shipped -> delivered carry the shipping details", async () => {
    const fake = setup("shipped")
    const r = await updateOrderStatus({ orderId: ID, status: "delivered", shipping: SHIPPING })
    expect(r).toMatchObject({ ok: true })
    expect(fake.calls.some((c) => c.ops.some(([m]) => m === "update"))).toBe(true)
  })
})

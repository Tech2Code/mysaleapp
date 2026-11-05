"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { optionalNumber } from "@/lib/zod-helpers"
import { paymentReferenceSchema, shippingSchema } from "./schema"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, checkTransition } from "./transitions"
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./types"

const updateStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  /** Courier / tracking info; optional, normally sent together with "shipped". */
  shipping: shippingSchema.optional(),
})

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = updateStatusSchema.safeParse(input)
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    return fail("Please check the shipping details.", fieldErrors)
  }

  const { orderId, status, shipping } = parsed.data
  const supabase = await getServerSupabase()

  const { data: current } = await supabase
    .from("orders")
    .select("status, payment_status, shipping_carrier")
    .eq("id", orderId)
    .maybeSingle<{ status: OrderStatus; payment_status: PaymentStatus | null; shipping_carrier: string | null }>()
  if (!current) return fail("Order not found")

  // One rule set for every move (see transitions.ts): allowed next step, payment first, courier before "shipped".
  const problem = checkTransition({
    from: current.status,
    to: status,
    payment: current.payment_status ?? "pending",
    hasCourier: Boolean(shipping?.carrier ?? current.shipping_carrier),
  })
  if (problem) return fail(problem)

  // The DB trigger writes the status-history row when the status changes.
  const { error } = await supabase
    .from("orders")
    .update({
      status,
      ...(shipping
        ? {
            shipping_carrier: shipping.carrier,
            tracking_number: shipping.trackingNumber ?? null,
            tracking_url: shipping.trackingUrl ?? null,
            expected_delivery: shipping.expectedDelivery ?? null,
          }
        : {}),
    })
    .eq("id", orderId)

  if (error) {
    // 42703 / PGRST204 = column missing → migration 0002 hasn't been run yet.
    if (shipping && (error.code === "42703" || error.code === "PGRST204")) {
      return fail("Shipping columns are missing. Run the latest database migrations (npm run db:push).")
    }
    return fail("Could not update status")
  }

  revalidatePath("/admin", "layout")
  return { ok: true }
}

const blankToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v)

const updatePaymentSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(PAYMENT_STATUSES),
  method: z.preprocess(blankToNull, z.enum(PAYMENT_METHODS).nullable()),
  /** UTR / transaction id. */
  reference: z.preprocess(blankToNull, paymentReferenceSchema.nullable()),
  /** Amount actually received (₹). Defaults to the order total when marking as paid. */
  amount: optionalNumber.pipe(z.number().min(0).max(10_000_000).nullable()),
  /** Shown to the customer (e.g. why a payment was rejected). */
  note: z.preprocess(blankToNull, z.string().trim().max(300, "Keep the note under 300 characters").nullable()),
})

/**
 * Record the outcome of a payment. Marking it "paid" also confirms the order
 * (if it was still pending), which is how the customer sees their order go forward.
 */
export async function updateOrderPayment(input: unknown): Promise<ActionResult<{ confirmed: boolean }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = updatePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the payment details.", z.flattenError(parsed.error).fieldErrors)
  }
  const p = parsed.data

  const supabase = await getServerSupabase()
  const { data: order } = await supabase
    .from("orders")
    .select("status, total, payment_status")
    .eq("id", p.orderId)
    .maybeSingle<{ status: OrderStatus; total: number | string; payment_status: PaymentStatus | null }>()
  if (!order) return fail("Order not found")

  if (order.status === "cancelled" && (p.status === "paid" || p.status === "submitted")) {
    return fail("This order is cancelled. Record a refund instead of a payment.")
  }

  const markPaid = p.status === "paid"
  const confirmNow = markPaid && order.status === "pending"

  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: p.status,
      payment_method: p.method ?? (markPaid ? "upi" : null),
      payment_reference: p.reference,
      payment_amount: markPaid ? (p.amount ?? Number(order.total)) : p.amount,
      payment_note: p.note,
      ...(p.status === "refunded" ? { refunded_at: new Date().toISOString() } : {}),
      // keep the original paid time if it was already paid
      ...(markPaid && order.payment_status !== "paid" ? { payment_paid_at: new Date().toISOString() } : {}),
      ...(confirmNow ? { status: "confirmed" as const } : {}),
    })
    .eq("id", p.orderId)

  if (error) {
    if (error.code === "23505") return fail("This reference number is already attached to another order.")
    if (error.code === "42703" || error.code === "PGRST204") {
      return fail("Payment columns are missing. Run the latest database migrations (npm run db:push).")
    }
    return fail("Could not save payment details")
  }

  revalidatePath("/admin", "layout")
  return { ok: true, data: { confirmed: confirmNow } }
}

const noteSchema = z.object({ orderId: z.uuid(), note: z.string().trim().max(1000) })

export async function updateAdminNote(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return fail("Note is too long")

  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from("orders")
    .update({ admin_note: parsed.data.note || null })
    .eq("id", parsed.data.orderId)
  if (error) return fail("Could not save note")

  revalidatePath(`/admin/orders/${parsed.data.orderId}`)
  return { ok: true }
}

const cancelSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(ADMIN_CANCEL_REASONS),
  /** Extra detail shown to the customer. */
  detail: z.string().trim().max(200, "Keep it under 200 characters").optional(),
})

/** Cancel an order (until it is packed). The customer sees the reason; a paid order is flagged "refund due". */
export async function cancelOrderAsAdmin(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return fail("Please choose a reason.", z.flattenError(parsed.error).fieldErrors)
  const { orderId, reason, detail } = parsed.data

  const supabase = await getServerSupabase()
  const { data: current } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle<{ status: OrderStatus }>()
  if (!current) return fail("Order not found")
  if (!CANCELLABLE_BY_ADMIN.includes(current.status)) {
    return fail(
      current.status === "cancelled"
        ? "This order is already cancelled."
        : "A shipped or delivered order can't be cancelled here. Handle it as a return."
    )
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: detail ? `${reason}: ${detail}` : reason,
      cancelled_by: "admin",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId)
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204") {
      return fail("Cancellation columns are missing. Run the latest database migrations (npm run db:push).")
    }
    return fail("Could not cancel the order")
  }

  revalidatePath("/admin", "layout")
  return { ok: true }
}

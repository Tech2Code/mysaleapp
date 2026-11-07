"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { CACHE_TAGS } from "@/features/products/queries"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { optionalNumber } from "@/lib/zod-helpers"
import { paymentReferenceSchema, shippingSchema } from "./schema"
import { lockedMessage } from "./locking"
import { isPaymentMoneyLocked, paymentUpdateProblem } from "./payment-rules"
import { mapRpcError } from "./rpc-errors"
import { OTHER_DETAIL_MESSAGE, cancelReasonText, otherNeedsDetail } from "./reasons"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, checkTransition } from "./transitions"
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, type OrderStatus, type PaymentStatus } from "./types"

const updateStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
  /** The status the admin's screen was showing; if the order has moved on since (another tab, the customer), refuse. */
  expectedStatus: z.enum(ORDER_STATUSES).optional(),
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
  if (parsed.data.expectedStatus && parsed.data.expectedStatus !== current.status) {
    return fail("This order was just changed by someone else. Refresh the page and try again.")
  }
  // Delivered / cancelled orders are frozen (shipping, status). The DB trigger lock_finished_orders enforces the same.
  const locked = lockedMessage(current.status)
  if (locked) return fail(locked)

  // One rule set for every move (see transitions.ts): allowed next step, payment first, courier before "shipped".
  const problem = checkTransition({
    from: current.status,
    to: status,
    payment: current.payment_status ?? "pending",
    hasCourier: Boolean(shipping?.carrier ?? current.shipping_carrier),
  })
  if (problem) return fail(problem)

  // The DB trigger writes the status-history row when the status changes.
  // `.eq("status", current.status)` makes this a compare-and-set: if another tab or the customer
  // changed the order since we read it, nothing is updated and we ask for a refresh.
  const { data: updated, error } = await supabase
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
    .eq("status", current.status)
    .select("id")

  if (error) {
    return fail("Could not update status")
  }
  if (!updated?.length) return fail("This order was just changed by someone else. Refresh the page and try again.")

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
  /** The refunded_amount the screen was showing; a refund is refused if it has changed (double click / stale tab). */
  expectedRefunded: z.number().min(0).max(10_000_000).optional(),
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
    .select("status, total, payment_status, payment_amount, refunded_amount, payment_reference")
    .eq("id", p.orderId)
    .maybeSingle<{
      status: OrderStatus
      total: number | string
      payment_status: PaymentStatus | null
      payment_amount: number | string | null
      refunded_amount: number | string | null
      payment_reference: string | null
    }>()
  if (!order) return fail("Order not found")

  if (order.status === "cancelled" && (p.status === "paid" || p.status === "submitted")) {
    return fail("This order is cancelled. Record a refund instead of a payment.")
  }

  // A paid order never goes back to unpaid, a refunded one is terminal, and after delivery the received amount / UTR are locked
  // (same rules as the form and the DB trigger guard_payment_status, see payment-rules.ts).
  const rule = paymentUpdateProblem(
    {
      status: order.status,
      paymentStatus: order.payment_status ?? "pending",
      paymentAmount: order.payment_amount == null ? null : Number(order.payment_amount),
      paymentReference: order.payment_reference,
    },
    { status: p.status, amount: p.amount, reference: p.reference }
  )
  if (rule && !(p.status === "refunded" && order.payment_status === "refunded")) return fail(rule)

  // Refunds have one path (refund_order RPC): it keeps payment_status, refunded_at and refunded_amount in step.
  if (p.status === "refunded" && order.payment_status === "paid") {
    const paid = Number(order.payment_amount ?? order.total)
    const left = Math.max(0, paid - Number(order.refunded_amount ?? 0))
    if (p.amount !== null && p.amount > left + 0.005) return fail(`You can refund at most ₹${left.toFixed(2)}.`, { amount: [`At most ₹${left.toFixed(2)}`] })
    if (p.amount === 0) return fail("Enter an amount above 0, or leave it blank to refund everything.", { amount: ["Enter an amount above 0"] })
    const { error: refundError } = await supabase.rpc("refund_order", {
      p_order_id: p.orderId,
      // blank or the whole remaining amount = full refund
      p_amount: p.amount === null || p.amount >= left - 0.005 ? null : p.amount,
      p_expected_status: order.status,
      // the form pre-fills the customer's own payment UTR; that is not a refund reference, so only a different value is kept
      p_reference: p.reference && p.reference !== order.payment_reference ? p.reference : null,
      p_note: p.note,
      // idempotency: the DB refuses (ORDER_CHANGED) if refunded_amount is no longer what the admin's screen showed
      p_expected_refunded: p.expectedRefunded ?? null,
    })
    if (refundError) {
      if (refundError.message.includes("ORDER_CHANGED") || refundError.message.includes("NOT_PAID")) return fail(mapRpcError("ORDER_CHANGED", "This order was just changed by someone else. Refresh the page and try again."))
      if (refundError.message.includes("BAD_AMOUNT")) return fail("That refund amount is not valid for this order.", { amount: ["Not a valid amount"] })
      return fail("Could not record the refund")
    }
    revalidatePath("/admin", "layout")
    return { ok: true, data: { confirmed: false } }
  }
  if (p.status === "refunded" && order.payment_status !== "refunded") {
    return fail("Only a paid order can be refunded.")
  }

  const markPaid = p.status === "paid"
  const confirmNow = markPaid && order.status === "pending"

  // Finished + paid/refunded: only the method and the note may still be edited (the DB refuses anything else)
  const moneyLocked = isPaymentMoneyLocked({ status: order.status, paymentStatus: order.payment_status ?? "pending" })

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      payment_status: p.status,
      payment_method: p.method ?? (markPaid ? "upi" : null),
      ...(moneyLocked
        ? {}
        : {
            payment_reference: p.reference,
            payment_amount: markPaid ? (p.amount ?? Number(order.total)) : p.amount,
          }),
      payment_note: p.note,
      // keep the original paid time if it was already paid
      ...(markPaid && order.payment_status !== "paid" ? { payment_paid_at: new Date().toISOString() } : {}),
      ...(confirmNow ? { status: "confirmed" as const } : {}),
    })
    .eq("id", p.orderId)
    .eq("status", order.status) // compare-and-set: a customer cancel in between must not be overwritten
    .select("id")

  if (error) {
    if (error.code === "23505") return fail("This reference number is already attached to another order.")
    return fail("Could not save payment details")
  }
  if (!updated?.length) return fail("This order was just changed by someone else. Refresh the page and try again.")

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
  // The note lives in its own admin-only table, so customers can never read it (even via their own orders).
  const { error } = parsed.data.note
    ? await supabase
        .from("order_admin_notes")
        .upsert({ order_id: parsed.data.orderId, note: parsed.data.note }, { onConflict: "order_id" })
    : await supabase.from("order_admin_notes").delete().eq("order_id", parsed.data.orderId)
  if (error) return fail("Could not save note")

  revalidatePath(`/admin/orders/${parsed.data.orderId}`)
  return { ok: true }
}

const cancelSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(ADMIN_CANCEL_REASONS),
  /** Extra detail shown to the customer. */
  detail: z.string().trim().max(200, "Keep it under 200 characters").optional(),
}).refine((v) => !otherNeedsDetail(v.reason, v.detail), { path: ["detail"], error: OTHER_DETAIL_MESSAGE })

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

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancel_reason: cancelReasonText(reason, detail),
      cancelled_by: "admin",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", current.status)
    .select("id")
  if (error) {
    return fail("Could not cancel the order")
  }
  if (!updated?.length) return fail("This order was just changed by someone else. Refresh the page and try again.")

  updateTag(CACHE_TAGS.products) // the DB trigger gave the reserved stock back
  revalidatePath("/admin", "layout")
  return { ok: true }
}

const returnSchema = z.object({
  orderId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        name: z.string().trim().max(120),
        quantity: z.number().int().min(1).max(999),
        restock: z.boolean(),
      })
    )
    .min(1, "Enter how many came back")
    .max(50),
  reason: z.string().trim().max(300, "Keep the reason under 300 characters").optional(),
  refund: z.boolean(),
  /** The customer's return request this return closes (if it came from one). */
  requestId: z.uuid().optional(),
})

/** Record goods that came back: per item, choose whether it goes back into stock (resellable) or not (damaged). */
export async function recordOrderReturn(input: unknown): Promise<ActionResult<{ restocked: number; refundedAmount: number; fullyRefunded: boolean }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = returnSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the return details.", z.flattenError(parsed.error).fieldErrors)
  const { orderId, items, reason, refund, requestId } = parsed.data

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("record_order_return", {
    p_order_id: orderId,
    p_items: items,
    p_reason: reason ?? null,
    p_refund: refund,
    ...(requestId ? { p_request_id: requestId } : {}),
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not record the return"))
  }

  updateTag(CACHE_TAGS.products) // restocked items are sellable again
  revalidatePath("/admin", "layout")
  const out = (data ?? {}) as { restocked?: number; refundedAmount?: number; fullyRefunded?: boolean }
  return {
    ok: true,
    data: {
      restocked: Number(out.restocked ?? 0),
      refundedAmount: Number(out.refundedAmount ?? 0),
      fullyRefunded: Boolean(out.fullyRefunded),
    },
  }
}

const decideSchema = z.object({
  requestId: z.uuid(),
  approve: z.boolean(),
  /** Approve: pickup / shipping instructions (optional). Reject: the reason (required). */
  note: z.string().trim().max(300, "Keep it under 300 characters").optional(),
})

/** Approve a customer's return request (with instructions) or reject it (with a reason the customer sees). */
export async function decideReturnRequest(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = decideSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.", z.flattenError(parsed.error).fieldErrors)
  const { requestId, approve, note } = parsed.data
  if (!approve && !note) return fail("Tell the customer why the return isn't approved.", { note: ["Write a reason"] })

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("decide_return_request", { p_request_id: requestId, p_approve: approve, p_note: note ?? null })
  if (error) {
    if (error.message.includes("NOT_PENDING")) return fail("This request was already decided or withdrawn.")
    return fail("Could not save your decision")
  }
  revalidatePath("/admin", "layout")
  revalidatePath("/account", "layout")
  return { ok: true }
}

const refundReturnSchema = z.object({
  returnId: z.uuid(),
  /** The refunded_amount the screen showed; the DB refuses if it moved on (double click / stale tab). */
  expectedRefunded: z.number().min(0).max(10_000_000).optional(),
})

/**
 * Refund the items of ONE earlier return that was recorded without a refund. Same bookkeeping as ticking
 * "I have refunded these items" when recording the return (migration 0024, RPC refund_return): it marks the
 * return refunded, adds its item value to refunded_amount and marks the payment Refunded once every item is.
 */
export async function refundReturn(input: unknown): Promise<ActionResult<{ refundedAmount: number; fullyRefunded: boolean }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = refundReturnSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.")

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("refund_return", {
    p_return_id: parsed.data.returnId,
    p_expected_refunded: parsed.data.expectedRefunded ?? null,
  })
  if (error) return fail(mapRpcError(error.message, "Could not record the refund"))
  revalidatePath("/admin", "layout")
  revalidatePath("/account", "layout")
  const out = (data ?? {}) as { refundedAmount?: number; fullyRefunded?: boolean }
  return { ok: true, data: { refundedAmount: Number(out.refundedAmount ?? 0), fullyRefunded: Boolean(out.fullyRefunded) } }
}

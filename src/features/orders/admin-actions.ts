"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { CACHE_TAGS } from "@/features/products/queries"
import { fail, type ActionResult } from "@/lib/action-result"
import { formatDateTime } from "@/lib/format"
import { getServerSupabase } from "@/lib/supabase/server"
import { LIMITS, v } from "@/lib/validation"
import { expectedDeliveryProblem, paymentReferenceSchema, shippingSchema } from "./schema"
import { lockedMessage } from "./locking"
import { isPaymentMoneyLocked, paymentUpdateProblem } from "./payment-rules"
import { mapRpcError } from "./rpc-errors"
import { OTHER_DETAIL_MESSAGE, OTHER_DETAIL_MIN, cancelReasonText, otherNeedsDetail } from "./reasons"
import { ADMIN_CANCEL_REASONS, CANCELLABLE_BY_ADMIN, checkTransition, isRevertTransition } from "./transitions"
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, STATUS_META, type OrderStatus, type PaymentStatus } from "./types"

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
    .select("status, payment_status, shipping_carrier, expected_delivery")
    .eq("id", orderId)
    .maybeSingle<{ status: OrderStatus; payment_status: PaymentStatus | null; shipping_carrier: string | null; expected_delivery: string | null }>()
  if (!current) return fail("Order not found")
  const dateProblem = expectedDeliveryProblem(shipping?.expectedDelivery, current.expected_delivery)
  if (dateProblem) return fail("Please check the shipping details.", { expectedDelivery: [dateProblem] })
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

  revalidatePathsForAdmin(orderId)
  revalidatePathsForCustomer()
  return { ok: true }
}

const revertStatusSchema = z.object({
  orderId: z.uuid(),
  expectedStatus: z.enum(ORDER_STATUSES),
  toStatus: z.enum(ORDER_STATUSES),
  reason: z.string().trim().min(OTHER_DETAIL_MIN, OTHER_DETAIL_MESSAGE).max(LIMITS.cancelDetail.max, "Reason is too long"),
  clearShipping: z.boolean().optional(),
})

/**
 * Reverts an order's fulfilment status by one step (Delivered -> Shipped -> Packed -> Confirmed -> Pending).
 * Logs the mandatory admin reason into the private `order_admin_notes` table and cleans up reverted timeline history.
 */
export async function revertOrderStatus(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = revertStatusSchema.safeParse(input)
  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error)
    return fail(fieldErrors.reason?.[0] ?? "Please enter a valid reason for reverting the status.", fieldErrors)
  }

  const { orderId, expectedStatus, toStatus, reason, clearShipping } = parsed.data
  if (!isRevertTransition(expectedStatus, toStatus)) {
    return fail(`An order cannot be reverted from ${STATUS_META[expectedStatus].label} to ${STATUS_META[toStatus].label}.`)
  }

  const supabase = await getServerSupabase()
  const { data: current } = await supabase
    .from("orders")
    .select("status, payment_status, refunded_amount")
    .eq("id", orderId)
    .maybeSingle<{ status: OrderStatus; payment_status: PaymentStatus | null; refunded_amount: number | string | null }>()

  if (!current) return fail("Order not found")
  if (current.status !== expectedStatus) {
    return fail("This order was just changed by someone else. Refresh the page and try again.")
  }

  if (current.status === "delivered") {
    if (current.payment_status === "refunded" || Number(current.refunded_amount ?? 0) > 0) {
      return fail("This order already has a refund recorded, so its Delivered status cannot be reverted.")
    }
    const [{ count: reqCount }, { count: retCount }] = await Promise.all([
      supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("order_id", orderId),
      supabase.from("order_returns").select("id", { count: "exact", head: true }).eq("order_id", orderId),
    ])
    if ((reqCount ?? 0) > 0 || (retCount ?? 0) > 0) {
      return fail("This order already has a return request or return in progress, so its Delivered status cannot be reverted.")
    }
  }

  const shouldClearShipping = expectedStatus === "shipped" && Boolean(clearShipping)

  const { error: rpcError } = await supabase.rpc("revert_order_status", {
    p_order_id: orderId,
    p_expected_status: expectedStatus,
    p_to_status: toStatus,
    p_clear_shipping: shouldClearShipping,
  })

  if (rpcError) {
    const fnMissing = rpcError.code === "PGRST202" || rpcError.message.includes("revert_order_status")
    if (fnMissing && expectedStatus !== "delivered") {
      // Fallback for non-delivered steps if the SQL migration hasn't been applied yet
      const { data: updated, error: updateErr } = await supabase
        .from("orders")
        .update({
          status: toStatus,
          ...(shouldClearShipping
            ? {
                shipping_carrier: null,
                tracking_number: null,
                tracking_url: null,
                expected_delivery: null,
              }
            : {}),
        })
        .eq("id", orderId)
        .eq("status", expectedStatus)
        .select("id")

      if (updateErr || !updated?.length) {
        return fail(mapRpcError(updateErr?.message ?? "", "Could not revert the order status."))
      }
    } else {
      return fail(mapRpcError(rpcError.message, "Could not revert the order status."))
    }
  }

  // Append the revert audit entry to the private admin note so the customer never sees internal revert notes
  const { data: existingNote } = await supabase
    .from("order_admin_notes")
    .select("note")
    .eq("order_id", orderId)
    .maybeSingle<{ note: string }>()

  const auditLine = `[${formatDateTime(new Date().toISOString())}] Reverted ${STATUS_META[expectedStatus].label} → ${STATUS_META[toStatus].label}: ${reason}`
  const combinedNote = existingNote?.note?.trim()
    ? `${existingNote.note.trim()}\n${auditLine}`.slice(0, LIMITS.adminNote.max)
    : auditLine.slice(0, LIMITS.adminNote.max)

  await supabase.from("order_admin_notes").upsert({ order_id: orderId, note: combinedNote }, { onConflict: "order_id" })

  revalidatePathsForAdmin(orderId)
  revalidatePathsForCustomer()
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
  amount: v.optionalMoney(LIMITS.paymentAmount.max),
  /** Shown to the customer (e.g. why a payment was rejected). */
  note: z.preprocess(blankToNull, v.note(LIMITS.paymentNote.max).nullable()),
  /** The refunded_amount the screen was showing; a refund is refused if it has changed (double click / stale tab). */
  expectedRefunded: z.number().min(0).max(LIMITS.paymentAmount.max).optional(),
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

  // A cancelled order can't take a NEW payment; confirming one the customer already submitted (so it can be refunded) is fine.
  if (order.status === "cancelled" && (p.status === "submitted" || (p.status === "paid" && order.payment_status !== "submitted" && order.payment_status !== "paid"))) {
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
    if (!p.reference) return fail("Enter the refund UTR / reference number.", { reference: ["Enter the refund reference number"] })
    if (p.reference === order.payment_reference) {
      return fail("Enter your refund UTR, not the customer's incoming payment UTR.", { reference: ["Must be the refund UTR"] })
    }
    if (p.amount === null || p.amount <= 0) return fail("Enter the refund amount.", { amount: ["Enter an amount above 0"] })
    if (p.amount > left + 0.005) return fail(`You can refund at most ₹${left.toFixed(2)}.`, { amount: [`At most ₹${left.toFixed(2)}`] })
    if (!p.note || p.note.trim().length < 3) {
      return fail("Enter a refund reason / note for the customer.", { note: ["Enter a refund note (at least 3 characters)"] })
    }
    const { error: refundError } = await supabase.rpc("refund_order", {
      p_order_id: p.orderId,
      // blank or the whole remaining amount = full refund
      p_amount: p.amount >= left - 0.005 ? null : p.amount,
      p_expected_status: order.status,
      p_reference: p.reference,
      p_note: p.note,
      // idempotency: the DB refuses (ORDER_CHANGED) if refunded_amount is no longer what the admin's screen showed
      p_expected_refunded: p.expectedRefunded ?? null,
    })
    if (refundError) {
      if (refundError.message.includes("ORDER_CHANGED") || refundError.message.includes("NOT_PAID")) return fail(mapRpcError("ORDER_CHANGED", "This order was just changed by someone else. Refresh the page and try again."))
      if (refundError.message.includes("BAD_AMOUNT")) return fail("That refund amount is not valid for this order.", { amount: ["Not a valid amount"] })
      return fail("Could not record the refund")
    }
    revalidatePathsForAdmin(p.orderId)
    revalidatePathsForCustomer()
    return { ok: true, data: { confirmed: false } }
  }
  if (p.status === "refunded" && order.payment_status !== "refunded") {
    return fail("Only a paid order can be refunded.")
  }
  if (p.status === "failed" && (!p.note || p.note.trim().length < 5)) {
    return fail("Enter the reason for rejecting the payment.", { note: ["Enter a reason (at least 5 characters)"] })
  }

  const markPaid = p.status === "paid"
  const confirmNow = markPaid && order.status === "confirmed" ? false : markPaid && order.status === "pending"
  const alreadyRefunded = order.payment_status === "refunded"

  // Finished + paid, or any refunded order: only the method and the note may still be edited (never amount / reference).
  const moneyLocked = alreadyRefunded || isPaymentMoneyLocked({ status: order.status, paymentStatus: order.payment_status ?? "pending" })

  const { data: updated, error } = await supabase
    .from("orders")
    .update({
      payment_status: p.status,
      ...(alreadyRefunded && p.method === null ? {} : { payment_method: p.method ?? (markPaid ? "upi" : null) }),
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

  revalidatePathsForAdmin(p.orderId)
  revalidatePathsForCustomer()
  return { ok: true, data: { confirmed: confirmNow } }
}

const REVERT_AUDIT_LINE_RE = /^\[[^\]]+\] Reverted .+ → .+: .+$/

function splitAdminNote(raw: string | null | undefined): { editableNote: string; auditLines: string[] } {
  if (!raw) return { editableNote: "", auditLines: [] }
  const lines = raw.split(/\r?\n/)
  const auditLines: string[] = []
  const editableLines: string[] = []
  for (const line of lines) {
    if (REVERT_AUDIT_LINE_RE.test(line.trim())) {
      auditLines.push(line.trim())
    } else {
      editableLines.push(line)
    }
  }
  return {
    editableNote: editableLines.join("\n").trim(),
    auditLines,
  }
}

const noteSchema = z.object({ orderId: z.uuid(), note: v.note(LIMITS.adminNote.max) })

export async function updateAdminNote(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return fail("Note is too long")

  const supabase = await getServerSupabase()
  // Read existing note first so immutable status-revert audit lines can never be edited or cleared
  const { data: existing } = await supabase
    .from("order_admin_notes")
    .select("note")
    .eq("order_id", parsed.data.orderId)
    .maybeSingle<{ note: string }>()

  const { auditLines } = splitAdminNote(existing?.note)
  const { editableNote: cleanUserNote } = splitAdminNote(parsed.data.note)

  const finalNote = [cleanUserNote, ...auditLines].filter(Boolean).join("\n").slice(0, LIMITS.adminNote.max)

  // The note lives in its own admin-only table, so customers can never read it (even via their own orders).
  const { error } = finalNote
    ? await supabase
        .from("order_admin_notes")
        .upsert({ order_id: parsed.data.orderId, note: finalNote }, { onConflict: "order_id" })
    : await supabase.from("order_admin_notes").delete().eq("order_id", parsed.data.orderId)
  if (error) return fail("Could not save note")

  revalidatePath(`/admin/orders/${parsed.data.orderId}`)
  return { ok: true }
}

const cancelSchema = z.object({
  orderId: z.uuid(),
  reason: z.enum(ADMIN_CANCEL_REASONS),
  /** Extra detail shown to the customer. */
  detail: v.note(LIMITS.cancelDetail.max).optional(),
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
  revalidatePathsForAdmin(orderId)
  revalidatePathsForCustomer()
  return { ok: true }
}

const returnSchema = z.object({
  orderId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        name: z.string().trim().max(LIMITS.productName.max),
        quantity: v.quantity(LIMITS.returnQuantity.max),
        restock: z.boolean(),
      })
    )
    .min(1, "Enter how many came back")
    .max(LIMITS.returnLines.max)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Each item can only be listed once"),
  reason: v.note(LIMITS.returnDetail.max).optional(),
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
  if (!requestId && (!reason || reason.trim().length < 3)) {
    return fail("Enter the reason for the return.", { reason: ["Enter a reason (at least 3 characters)"] })
  }

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
  revalidatePathsForAdmin(orderId)
  revalidatePathsForCustomer()
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
  note: v.note(LIMITS.returnDetail.max).optional(),
  /** Approve: the day the goods are collected (YYYY-MM-DD). */
  pickupDate: v.futureDate(LIMITS.pickupDays.max).optional(),
})

/** Approve a customer's return request (with instructions) or reject it (with a reason the customer sees). */
export async function decideReturnRequest(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = decideSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.", z.flattenError(parsed.error).fieldErrors)
  const { requestId, approve, note, pickupDate } = parsed.data
  if (approve && !pickupDate) return fail("Pick the pickup date.", { pickupDate: ["Pick the pickup date"] })
  if (!approve && !note) return fail("Tell the customer why the return isn't approved.", { note: ["Write a reason"] })

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("decide_return_request", { p_request_id: requestId, p_approve: approve, p_note: note ?? null, p_pickup_date: approve ? pickupDate : null })
  if (error) {
    if (error.message.includes("NOT_PENDING")) return fail("This request was already decided or withdrawn.")
    if (error.message.includes("BAD_PICKUP_DATE")) return fail(mapRpcError("BAD_PICKUP_DATE", "Pick a valid date"), { pickupDate: ["Pick a date from today"] })
    return fail("Could not save your decision")
  }
  revalidatePathsForAdmin()
  revalidatePathsForCustomer()
  return { ok: true }
}

function revalidatePathsForAdmin(orderId?: string) {
  revalidatePath("/admin/orders")
  if (orderId) revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath("/admin", "layout")
}

/** The customer, `/track` and order list pages show the order status too: refresh them after any admin change that affects it. */
function revalidatePathsForCustomer() {
  revalidatePath("/account", "layout")
  revalidatePath("/track")
}

const pickedUpSchema = z.object({ requestId: z.uuid() })

/** The courier collected the goods of an approved return ("Pickup successful"). */
export async function markReturnPickedUp(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = pickedUpSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.")

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("mark_return_picked_up", { p_request_id: parsed.data.requestId })
  if (error) {
    if (error.message.includes("NOT_PENDING")) return fail("This return is not waiting for a pickup any more. Refresh the page.")
    return fail("Could not save the pickup")
  }
  revalidatePathsForAdmin()
  revalidatePathsForCustomer()
  return { ok: true }
}

/** Take back the last step of a return request (pickup, approval or rejection). Received / refunded steps stay. */
export async function undoReturnStep(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = pickedUpSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.")

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("undo_return_step", { p_request_id: parsed.data.requestId })
  if (error) return fail(mapRpcError(error.message, "Could not undo this step"))
  revalidatePathsForAdmin()
  revalidatePathsForCustomer()
  return { ok: true }
}

const refundReturnSchema = z.object({
  returnId: z.uuid(),
  /** The refunded_amount the screen showed; the DB refuses if it moved on (double click / stale tab). */
  expectedRefunded: z.number().min(0).max(LIMITS.paymentAmount.max).optional(),
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
  revalidatePathsForAdmin()
  revalidatePathsForCustomer()
  const out = (data ?? {}) as { refundedAmount?: number; fullyRefunded?: boolean }
  return { ok: true, data: { refundedAmount: Number(out.refundedAmount ?? 0), fullyRefunded: Boolean(out.fullyRefunded) } }
}

const createRequestSchema = z.object({
  orderId: z.uuid(),
  items: z
    .array(z.object({ productId: z.uuid(), name: z.string().max(LIMITS.productName.max), quantity: v.quantity(LIMITS.returnQuantity.max) }))
    .min(1, "Choose at least one item")
    .max(LIMITS.returnLines.max)
    .refine((items) => new Set(items.map((i) => i.productId)).size === items.length, "Each item can only be listed once"),
  reason: v.reason(),
  details: v.note(LIMITS.returnDetail.max).optional(),
})

/**
 * Open a return request for the customer (they asked on WhatsApp / phone). The return window does not apply: the shop
 * agreed outside the app. The request then waits for the normal approve / reject step.
 */
export async function createReturnRequestAsAdmin(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = createRequestSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the details.", z.flattenError(parsed.error).fieldErrors)
  const { orderId, items, reason, details } = parsed.data
  if (!details || details.trim().length < OTHER_DETAIL_MIN || otherNeedsDetail(reason, details)) {
    return fail(OTHER_DETAIL_MESSAGE, { details: [OTHER_DETAIL_MESSAGE] })
  }

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("admin_create_return_request", {
    p_order_id: orderId,
    p_items: items,
    p_reason: reason,
    p_details: details ?? null,
  })
  if (error) return fail(mapRpcError(error.message, "Could not create the return request"))
  revalidatePathsForAdmin(orderId)
  revalidatePathsForCustomer()
  return { ok: true }
}

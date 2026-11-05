"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { addAddressFromOrder } from "@/features/addresses/server"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { getActiveProducts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { cancelOrderSchema, placeOrderSchema, submitPaymentSchema, trackOrderSchema, updateDeliverySchema } from "./schema"
import { buildOrderMessage, shopWhatsappLink } from "./whatsapp"
import { mapFees, type OrderPricing, type TrackedOrder } from "./types"

const RPC_ERRORS: Record<string, string> = {
  INVALID_NAME: "Please enter a valid name.",
  INVALID_PHONE: "Please enter a valid 10-digit mobile number.",
  INVALID_ADDRESS: "Please enter your full address.",
  INVALID_CITY: "Please enter your city.",
  INVALID_PINCODE: "Please enter a valid 6-digit pincode.",
  INVALID_NOTE: "The note is too long.",
  INVALID_ITEMS: "Your cart is empty or has too many items.",
  INVALID_QUANTITY: "Each item can be ordered 1–20 at a time.",
  ITEM_UNAVAILABLE: "Some items in your cart are out of stock or no longer available. Please review your cart.",
  INVALID_REFERENCE: "That doesn't look like a UTR / UPI reference. It is usually a 12-digit number.",
  ORDER_NOT_FOUND: "We couldn't find that order.",
  ORDER_CANCELLED: "This order was cancelled.",
  ALREADY_PAID: "This order is already marked as paid.",
  DUPLICATE_REFERENCE: "This reference number was already used for another payment. Please check it and try again.",
  ALREADY_CANCELLED: "This order is already cancelled.",
  CANNOT_CANCEL: "This order is already packed, so it can't be cancelled here. Please message us on WhatsApp.",
  NOT_EDITABLE: "This order is already confirmed, so the delivery details can't be changed. Message us on WhatsApp for help.",
}

function mapRpcError(message: string, fallback: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k))
  return key ? RPC_ERRORS[key] : fallback
}

export type PlacedOrder = { orderCode: string; total: number; phoneLast4: string; whatsappUrl: string }

type CreateOrderRow = {
  order_code: string
  subtotal: number | string
  shipping_fee: number | string
  shipping_fee_original: number | string
  extra_fees: { label: string; amount: number | string }[] | null
  total: number | string
}

/**
 * Saves the order (prices are computed by the database, never trusted from the
 * browser). The customer then pays by UPI; the order is confirmed once we verify it.
 */
export async function placeOrder(input: unknown): Promise<ActionResult<PlacedOrder>> {
  const parsed = placeOrderSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) {
    return fail("The store is in demo mode — connect Supabase to accept orders (see README).")
  }

  const { customer, items, saveAddress } = parsed.data
  const phone = normalizeIndianPhone(customer.phone)!
  const supabase = await getServerSupabase()
  const shop = await getStoreSettings()

  const { data, error } = await supabase
    .rpc("create_order", {
      p_customer: { ...customer, phone },
      p_items: items,
      p_prefix: shop.orderCodePrefix,
    })
    .single<CreateOrderRow>()

  if (error || !data) return fail(mapRpcError(error?.message ?? "", "Could not place your order. Please try again."))

  // The database calculated these (items + extra charges + delivery); we only display them.
  const pricing: OrderPricing = {
    subtotal: Number(data.subtotal),
    shippingFee: Number(data.shipping_fee),
    shippingFeeOriginal: Number(data.shipping_fee_original),
    extraFees: mapFees(data.extra_fees),
    total: Number(data.total),
  }

  // Signed-in customers can keep this address for next time.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    if (saveAddress) {
      await addAddressFromOrder(supabase, user.id, { ...customer, phone })
    }
    // Only fill the profile name/phone if they're still empty.
    await supabase.from("profiles").update({ full_name: customer.name }).eq("id", user.id).is("full_name", null)
    await supabase.from("profiles").update({ phone }).eq("id", user.id).is("phone", null)
  }

  // Optional message the customer can send to the shop with their order details.
  const products = await getActiveProducts()
  const lines = items.flatMap((line) => {
    const p = products.find((x) => x.id === line.productId)
    return p ? [{ name: p.name, price: p.price, quantity: line.quantity }] : []
  })
  const message = buildOrderMessage(shop, {
    orderCode: data.order_code,
    customer: { ...customer, phone },
    items: lines,
    pricing,
  })

  return {
    ok: true,
    data: {
      orderCode: data.order_code,
      total: pricing.total,
      phoneLast4: phone.slice(-4),
      whatsappUrl: shopWhatsappLink(shop, message),
    },
  }
}

export async function trackOrder(input: unknown): Promise<ActionResult<TrackedOrder>> {
  const parsed = trackOrderSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) return fail("Order tracking is unavailable in demo mode.")

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("track_order", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4,
  })

  if (error) return fail("Could not look up the order. Please try again.")
  if (!data) return fail("No order found with that code and phone number.")

  // Older database versions omit some fields, so default them.
  const t = data as TrackedOrder
  const subtotal = Number(t.subtotal)
  return {
    ok: true,
    data: {
      ...t,
      shipping: t.shipping ?? null,
      cancellation: t.cancellation ?? null,
      delivery: t.delivery ?? null,
      subtotal,
      shippingFee: Number(t.shippingFee ?? 0),
      shippingFeeOriginal: Number(t.shippingFeeOriginal ?? 0),
      extraFees: mapFees(t.extraFees),
      total: Number(t.total ?? subtotal),
      paymentStatus: t.paymentStatus ?? "pending",
      paymentMethod: t.paymentMethod ?? null,
      paymentReference: t.paymentReference ?? null,
      paymentAmount: t.paymentAmount == null ? null : Number(t.paymentAmount),
      paymentSubmittedAt: t.paymentSubmittedAt ?? null,
      paymentPaidAt: t.paymentPaidAt ?? null,
      paymentNote: t.paymentNote ?? null,
      items: t.items.map((i) => ({ ...i, price: Number(i.price) })),
    },
  }
}

/** The customer says "I paid" and gives the UPI reference (UTR). The admin then verifies it. */
export async function submitPayment(input: unknown): Promise<ActionResult> {
  const parsed = submitPaymentSchema.safeParse(input)
  if (!parsed.success) {
    return fail(
      "Please check the reference number.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>
    )
  }
  if (!isSupabaseConfigured) return fail("Payments are unavailable in demo mode.")

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("submit_payment", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4,
    p_reference: parsed.data.reference,
  })
  if (error) {
    // 42883 / PGRST202 = function missing → migration 0004 not applied yet.
    if (error.code === "42883" || error.code === "PGRST202") {
      return fail("Payments aren't set up yet. Please message us on WhatsApp.")
    }
    return fail(mapRpcError(error.message, "Could not submit your payment. Please try again."))
  }
  return { ok: true }
}

/** Change the delivery details of an order that is still pending (not yet confirmed). */
export async function updateOrderDelivery(input: unknown): Promise<ActionResult<{ phoneLast4: string }>> {
  const parsed = updateDeliverySchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")

  const { code, phoneLast4, customer } = parsed.data
  const phone = normalizeIndianPhone(customer.phone)!

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("update_order_delivery", {
    p_code: code,
    p_phone_last4: phoneLast4 ?? null,
    p_customer: { ...customer, phone },
  })
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return fail("Editing isn't set up yet. Please message us on WhatsApp.")
    }
    return fail(mapRpcError(error.message, "Could not update the delivery details. Please try again."))
  }

  const result = data as { phoneLast4?: string } | null
  return { ok: true, data: { phoneLast4: result?.phoneLast4 ?? phone.slice(-4) } }
}

/** The customer cancels their own order (until it is packed). A paid order is refunded by the shop. */
export async function cancelOrder(input: unknown): Promise<ActionResult<{ refundDue: boolean }>> {
  const parsed = cancelOrderSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the reason.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("cancel_order", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4 ?? null,
    p_reason: parsed.data.reason ?? null,
  })
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return fail("Cancelling isn't set up yet. Please message us on WhatsApp.")
    }
    return fail(mapRpcError(error.message, "Could not cancel the order. Please try again."))
  }
  revalidatePath("/account", "layout")
  return { ok: true, data: { refundDue: (data as { refundDue?: boolean } | null)?.refundDue === true } }
}

"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { addAddressFromOrder } from "@/features/addresses/server"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { CACHE_TAGS, getActiveProducts } from "@/features/products/queries"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { getStoreSettings } from "@/features/settings/queries"
import { joinCityState } from "@/features/location/states"
import { cancelReasonText } from "./reasons"
import { mapRpcError } from "./rpc-errors"
import { cancelOrderSchema, checkoutSchema, placeOrderSchema, requestReturnSchema, submitPaymentSchema, withdrawReturnSchema, trackOrderSchema, updateDeliverySchema } from "./schema"
import { returnWindow } from "./returns"
import { buildOrderMessage, shopWhatsappLink } from "./whatsapp"
import { mapFees, normalizePricing, type OrderPricing, type TrackedOrder } from "./types"

/**
 * Guest lookups (code + last 4 digits) answer {"ok":false,"error":"…"} instead of raising, so that
 * wrong attempts can be counted (see migration 0009). Returns the friendly message, or null if fine.
 */
function softRpcError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const { error } = data as { error?: unknown }
  return typeof error === "string" ? mapRpcError(error, "Could not find that order.") : null
}

/** The form has City and State; the database keeps both in `city` ("Mumbai, Maharashtra"). */
function storedCustomer(c: z.output<typeof checkoutSchema>) {
  const { state, ...rest } = c
  return { ...rest, city: joinCityState(c.city, state) }
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
  if (await limited("place-order")) return fail(RATE_LIMIT_MESSAGE)

  const { items, saveAddress } = parsed.data
  const customer = storedCustomer(parsed.data.customer)
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

  // The order reserved stock, so the cached catalogue (stock / "sold out") is stale now.
  updateTag(CACHE_TAGS.products)

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
  if (await limited("track-order")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const shop = await getStoreSettings()
  const { data, error } = await supabase.rpc("track_order", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4,
  })

  if (error) return fail("Could not look up the order. Please try again.")
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  if (!data) return fail("No order found with that code and phone number.")

  const t = data as TrackedOrder
  return {
    ok: true,
    data: {
      ...t,
      shipping: t.shipping ?? null,
      cancellation: t.cancellation ?? null,
      returns: t.returns ?? [],
      returnRequests: t.returnRequests ?? [],
      returnWindow: (() => {
        const days = shop.returnWindowDays
        const w = returnWindow(t.history ?? [], days, new Date())
        return { open: w.open, until: w.until ? w.until.toISOString() : null, days }
      })(),
      delivery: t.delivery ?? null,
      ...normalizePricing(t),
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
  if (await limited("submit-payment")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("submit_payment", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4,
    p_reference: parsed.data.reference,
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not submit your payment. Please try again."))
  }
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  return { ok: true }
}

/** Change the delivery details of an order that is still pending (not yet confirmed). */
export async function updateOrderDelivery(input: unknown): Promise<ActionResult<{ phoneLast4: string }>> {
  const parsed = updateDeliverySchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")
  if (await limited("update-delivery")) return fail(RATE_LIMIT_MESSAGE)

  const { code, phoneLast4 } = parsed.data
  const customer = storedCustomer(parsed.data.customer)
  const phone = normalizeIndianPhone(customer.phone)!

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("update_order_delivery", {
    p_code: code,
    p_phone_last4: phoneLast4 ?? null,
    p_customer: { ...customer, phone },
    // guests prove the order's current full number; the DB counts a wrong one toward the per-order lockout
    p_phone: parsed.data.phone ? normalizeIndianPhone(parsed.data.phone) : null,
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not update the delivery details. Please try again."))
  }

  const soft = softRpcError(data)
  if (soft) return fail(soft)
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
  if (await limited("cancel-order")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("cancel_order", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4 ?? null,
    p_reason: cancelReasonText(parsed.data.reason, parsed.data.detail),
    // guests must give the full number (migration 0022); signed-in owners are recognised by their account
    p_phone: parsed.data.phone ? normalizeIndianPhone(parsed.data.phone) : null,
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not cancel the order. Please try again."))
  }
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  updateTag(CACHE_TAGS.products) // cancelling gives the stock back
  revalidatePath("/account", "layout")
  return { ok: true, data: { refundDue: (data as { refundDue?: boolean } | null)?.refundDue === true } }
}

/** The customer asks to send items back (delivered orders, within the return window). The admin approves or rejects. */
export async function requestReturn(input: unknown): Promise<ActionResult> {
  const parsed = requestReturnSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the return details.", z.flattenError(parsed.error).fieldErrors)
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")
  if (await limited("request-return")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("request_return", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4 ?? null,
    p_items: parsed.data.items,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details ?? null,
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not send your return request. Please try again."))
  }
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

/** The customer takes back a return request that hasn't been reviewed yet. */
export async function withdrawReturnRequest(input: unknown): Promise<ActionResult> {
  const parsed = withdrawReturnSchema.safeParse(input)
  if (!parsed.success) return fail("Something went wrong. Please refresh and try again.")
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")
  if (await limited("withdraw-return")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("withdraw_return_request", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4 ?? null,
    p_request_id: parsed.data.requestId,
  })
  if (error) return fail(mapRpcError(error.message, "Could not withdraw the request. Please try again."))
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

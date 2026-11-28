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
import { getGatewayAdapter, getServiceRoleSupabase, isGatewayConfigured } from "./payment-gateway"
import { mapRpcError } from "./rpc-errors"
import { cancelOrderSchema, checkoutSchema, createGatewayOrderSchema, createGatewayRetrySchema, placeOrderSchema, requestReturnSchema, submitPaymentSchema, withdrawReturnSchema, trackOrderSchema, updateDeliverySchema, validatePromoSchema, verifyGatewayPaymentSchema } from "./schema"
import { composeReturnDetails, effectiveReturnDays, returnWindow } from "./returns"
import { buildOrderMessage, shopWhatsappLink } from "./whatsapp"
import type { ValidatedPromo } from "./pricing"
import { mapFees, normalizePricing, type GatewayClientSession, type OrderPricing, type TrackedOrder } from "./types"
import { formatPrice } from "@/lib/format"

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

export type PlacedOrder = {
  orderCode: string
  total: number
  phoneLast4: string
  whatsappUrl: string
  paymentReference?: string
  paymentConfirmed?: boolean
  createdAt?: string
}

type CreateOrderRow = {
  order_code: string
  subtotal: number | string
  shipping_fee: number | string
  shipping_fee_original: number | string
  extra_fees: { label: string; amount: number | string }[] | null
  discount_amount?: number | string | null
  promo_code?: string | null
  total: number | string
}

export async function validatePromoCode(input: unknown): Promise<ActionResult<ValidatedPromo>> {
  const parsed = validatePromoSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Enter a valid promo code.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) {
    return fail("Promo codes are unavailable in demo mode.")
  }
  if (await limited("track-order", "promo")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("validate_promo_code", {
    p_code: parsed.data.code,
    p_subtotal: parsed.data.subtotal,
  })
  if (error) return fail("Could not verify promo code. Please try again.")

  const raw = data as {
    ok?: boolean
    error?: string
    minOrderAmount?: number | string
    code?: string
    description?: string | null
    discountType?: "percent" | "flat"
    discountValue?: number | string
    maxDiscountAmount?: number | string | null
    discountAmount?: number | string
  } | null

  if (!raw || !raw.ok || !raw.code || !raw.discountType) {
    if (raw?.error === "PROMO_MIN_ORDER" && raw.minOrderAmount != null) {
      return fail(`Add items worth at least ${formatPrice(Number(raw.minOrderAmount))} to use this promo code.`)
    }
    return fail(mapRpcError(raw?.error ?? "", "That promo code is invalid or no longer active."))
  }

  return {
    ok: true,
    data: {
      code: raw.code,
      description: raw.description ?? null,
      discountType: raw.discountType,
      discountValue: Number(raw.discountValue ?? 0),
      minOrderAmount: Number(raw.minOrderAmount ?? 0),
      maxDiscountAmount: raw.maxDiscountAmount == null ? null : Number(raw.maxDiscountAmount),
      discountAmount: Number(raw.discountAmount ?? 0),
    },
  }
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

  const { items, paymentReference, promoCode, expectedTotal, saveAddress } = parsed.data
  const customer = storedCustomer(parsed.data.customer)
  const phone = normalizeIndianPhone(customer.phone)!
  const supabase = await getServerSupabase()
  const shop = await getStoreSettings()
  if (shop.paymentMode !== "manual_upi") {
    return fail("Online payment gateway is active. Please complete checkout using the online payment option.")
  }

  const { data, error } = await supabase
    .rpc("create_order", {
      p_customer: { ...customer, phone },
      p_items: items,
      p_prefix: shop.orderCodePrefix,
      p_promo_code: promoCode ?? null,
      p_expected_total: expectedTotal ?? null,
    })
    .single<CreateOrderRow>()

  if (error || !data) return fail(mapRpcError(error?.message ?? "", "Could not place your order. Please try again."))

  // Record the UPI payment reference & timestamp immediately upon order creation
  const { data: payData, error: payError } = await supabase.rpc("submit_payment", {
    p_code: data.order_code,
    p_phone_last4: phone.slice(-4),
    p_reference: paymentReference,
  })
  const paySoft = softRpcError(payData)
  if (payError || paySoft) {
    // Roll back the newly created order so no unpaid orphan order or stock lock remains
    await supabase.rpc("cancel_order", {
      p_code: data.order_code,
      p_phone_last4: phone.slice(-4),
      p_reason: "Payment reference verification failed during checkout",
      p_phone: phone,
    })
    return fail(
      paySoft ?? mapRpcError(payError?.message ?? "", "Could not record your payment reference. Please check your UTR and try again."),
      { paymentReference: [paySoft ?? mapRpcError(payError?.message ?? "", "Invalid or duplicate UTR reference number.")] }
    )
  }

  // The order reserved stock, so the cached catalogue (stock / "sold out") is stale now.
  updateTag(CACHE_TAGS.products)

  // The database calculated these (items + extra charges + delivery); we only display them.
  const pricing: OrderPricing = {
    subtotal: Number(data.subtotal),
    shippingFee: Number(data.shipping_fee),
    shippingFeeOriginal: Number(data.shipping_fee_original),
    extraFees: mapFees(data.extra_fees),
    promoCode: data.promo_code ?? null,
    discountAmount: Number(data.discount_amount ?? 0),
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
  const mergedLines = new Map<string, { productId: string; variantId?: string; quantity: number }>()
  for (const line of items) {
    const key = `${line.productId}::${line.variantId ?? ""}`
    const prev = mergedLines.get(key)
    mergedLines.set(key, { productId: line.productId, variantId: line.variantId, quantity: (prev?.quantity ?? 0) + line.quantity })
  }
  const lines = Array.from(mergedLines.values()).flatMap(({ productId, variantId, quantity }) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return []
    const matchedVar = variantId ? p.variants?.find((v) => v.id === variantId) : undefined
    const name = matchedVar?.label ? `${p.name} — ${matchedVar.label}` : p.name
    const price = matchedVar ? matchedVar.price : p.price
    return [{ name, price, quantity }]
  })
  const message = buildOrderMessage(shop, {
    orderCode: data.order_code,
    customer: { ...customer, phone },
    items: lines,
    pricing,
  })

  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")

  return {
    ok: true,
    data: {
      orderCode: data.order_code,
      total: pricing.total,
      phoneLast4: phone.slice(-4),
      whatsappUrl: shopWhatsappLink(shop, message),
      paymentReference: parsed.data.paymentReference,
      createdAt: new Date().toISOString(),
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

  const t = data as TrackedOrder & { updated_at?: string; requires_sign_in?: boolean }
  const normalizedItems = t.items.map((i) => ({
    ...i,
    price: Number(i.price),
    ...(i.returnWindowDays == null ? {} : { returnWindowDays: Number(i.returnWindowDays) }),
  }))
  const derivedOwner = Boolean(
    t.delivery ||
      t.paymentMethod ||
      (t.paymentReference && !t.paymentReference.includes("*"))
  )
  return {
    ok: true,
    data: {
      ...t,
      isOwner: t.isOwner ?? derivedOwner,
      requiresSignIn: t.requiresSignIn ?? t.requires_sign_in ?? false,
      updatedAt: t.updatedAt ?? t.updated_at,
      shipping: t.shipping ?? null,
      cancellation: t.cancellation ?? null,
      returns: t.returns ?? [],
      returnRequests: t.returnRequests ?? [],
      returnWindow: (() => {
        const days = effectiveReturnDays(shop.returnWindowDays, normalizedItems)
        const w = returnWindow(t.history ?? [], shop.returnWindowDays, new Date(), normalizedItems)
        return { open: w.open, until: w.until ? w.until.toISOString() : null, days }
      })(),
      delivery: t.delivery ?? null,
      ...normalizePricing(t),
      items: normalizedItems,
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
  if (await limited("submit-payment", parsed.data.code)) return fail(RATE_LIMIT_MESSAGE)

  const shop = await getStoreSettings()
  if (shop.paymentMode !== "manual_upi") {
    return fail("Manual UTR submission is disabled while online payment gateway is active.")
  }

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
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
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
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
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
    p_reason: cancelReasonText(parsed.data.reason, parsed.data.detail, parsed.data.refundUpiId),
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
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
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
    p_details:
      composeReturnDetails(
        parsed.data.details,
        parsed.data.pickupAddress,
        parsed.data.resolutionType === "refund" ? parsed.data.refundUpiId : null
      ) ?? null,
    // guests must give the full number (migration 0050); signed-in owners are recognised by their account
    p_phone: parsed.data.phone ? normalizeIndianPhone(parsed.data.phone) : null,
    p_resolution_type: parsed.data.resolutionType,
    p_exchange_preference: parsed.data.resolutionType === "exchange" ? (parsed.data.exchangePreference ?? null) : null,
  })
  if (error) {
    return fail(mapRpcError(error.message, "Could not send your return request. Please try again."))
  }
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
  return { ok: true }
}

/** The customer takes back a return request that hasn't been reviewed yet. */
export async function withdrawReturnRequest(input: unknown): Promise<ActionResult> {
  const parsed = withdrawReturnSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the mobile number and try again.")
  if (!isSupabaseConfigured) return fail("Unavailable in demo mode.")
  if (await limited("withdraw-return")) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("withdraw_return_request", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4 ?? null,
    p_request_id: parsed.data.requestId,
    p_phone: parsed.data.phone ? normalizeIndianPhone(parsed.data.phone) : null,
  })
  if (error) return fail(mapRpcError(error.message, "Could not cancel the request. Please try again."))
  const soft = softRpcError(data)
  if (soft) return fail(soft)
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
  return { ok: true }
}

/**
 * Payment Gateway Mode (when enabled in Admin -> Settings):
 * 1) Creates the order with server-computed pricing and stock lock (`create_order`),
 * 2) Creates a gateway order session via `PaymentGatewayAdapter` and stores `gateway_order_id`,
 * 3) Rolls back cleanly via `cancel_order` if session creation fails so no orphan order remains.
 */
export async function createGatewayCheckoutSession(
  input: unknown
): Promise<ActionResult<PlacedOrder & { session: GatewayClientSession }>> {
  const parsed = createGatewayOrderSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) {
    return fail("The store is in demo mode — connect Supabase to accept orders (see README).")
  }
  if (await limited("place-order")) return fail(RATE_LIMIT_MESSAGE)

  const shop = await getStoreSettings()
  if (shop.paymentMode !== "gateway") {
    return fail("Online payment gateway is not enabled on this store.")
  }
  const serviceSupabase = getServiceRoleSupabase()
  if (!serviceSupabase || !isGatewayConfigured(shop.paymentGateway)) {
    return fail("Online payment gateway is temporarily unavailable. Please try again later.")
  }

  const { items, promoCode, expectedTotal, saveAddress } = parsed.data
  const customer = storedCustomer(parsed.data.customer)
  const phone = normalizeIndianPhone(customer.phone)!
  const supabase = await getServerSupabase()

  const { data, error } = await supabase
    .rpc("create_order", {
      p_customer: { ...customer, phone },
      p_items: items,
      p_prefix: shop.orderCodePrefix,
      p_promo_code: promoCode ?? null,
      p_expected_total: expectedTotal ?? null,
    })
    .single<CreateOrderRow>()

  if (error || !data) return fail(mapRpcError(error?.message ?? "", "Could not place your order. Please try again."))

  let session: GatewayClientSession
  try {
    const adapter = getGatewayAdapter(shop.paymentGateway)
    session = await adapter.createOrderSession({
      orderCode: data.order_code,
      amountInr: Number(data.total),
      shopName: shop.shopName,
      customerName: customer.name,
      customerPhone: phone,
    })
    const { error: sessErr } = await serviceSupabase.rpc("record_gateway_session", {
      p_code: data.order_code,
      p_gateway: shop.paymentGateway,
      p_gateway_order_id: session.gatewayOrderId,
    })
    if (sessErr) throw sessErr
  } catch {
    await supabase.rpc("cancel_order", {
      p_code: data.order_code,
      p_phone_last4: phone.slice(-4),
      p_reason: "Payment gateway session could not be created",
      p_phone: phone,
    })
    return fail(mapRpcError("GATEWAY_UNAVAILABLE", "Online payment gateway is temporarily unavailable. Please try again."))
  }

  updateTag(CACHE_TAGS.products)

  const pricing: OrderPricing = {
    subtotal: Number(data.subtotal),
    shippingFee: Number(data.shipping_fee),
    shippingFeeOriginal: Number(data.shipping_fee_original),
    extraFees: mapFees(data.extra_fees),
    promoCode: data.promo_code ?? null,
    discountAmount: Number(data.discount_amount ?? 0),
    total: Number(data.total),
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    if (saveAddress) {
      await addAddressFromOrder(supabase, user.id, { ...customer, phone })
    }
    await supabase.from("profiles").update({ full_name: customer.name }).eq("id", user.id).is("full_name", null)
    await supabase.from("profiles").update({ phone }).eq("id", user.id).is("phone", null)
  }

  const products = await getActiveProducts()
  const mergedLines = new Map<string, { productId: string; variantId?: string; quantity: number }>()
  for (const line of items) {
    const key = `${line.productId}::${line.variantId ?? ""}`
    const prev = mergedLines.get(key)
    mergedLines.set(key, { productId: line.productId, variantId: line.variantId, quantity: (prev?.quantity ?? 0) + line.quantity })
  }
  const lines = Array.from(mergedLines.values()).flatMap(({ productId, variantId, quantity }) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return []
    const matchedVar = variantId ? p.variants?.find((v) => v.id === variantId) : undefined
    const name = matchedVar?.label ? `${p.name} — ${matchedVar.label}` : p.name
    const price = matchedVar ? matchedVar.price : p.price
    return [{ name, price, quantity }]
  })
  const message = buildOrderMessage(shop, {
    orderCode: data.order_code,
    customer: { ...customer, phone },
    items: lines,
    pricing,
  })

  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")

  return {
    ok: true,
    data: {
      orderCode: data.order_code,
      total: pricing.total,
      phoneLast4: phone.slice(-4),
      whatsappUrl: shopWhatsappLink(shop, message),
      createdAt: new Date().toISOString(),
      session,
    },
  }
}

/** Creates a fresh gateway checkout session for an existing pending/failed order on `/track` or `/account/orders/[code]`. */
export async function createGatewayRetrySession(input: unknown): Promise<ActionResult<{ session: GatewayClientSession }>> {
  const parsed = createGatewayRetrySchema.safeParse(input)
  if (!parsed.success) return fail("Invalid order details.")
  if (!isSupabaseConfigured) return fail("Payments are unavailable in demo mode.")
  if (await limited("gateway-payment", parsed.data.code)) return fail(RATE_LIMIT_MESSAGE)

  const shop = await getStoreSettings()
  if (shop.paymentMode !== "gateway") {
    return fail("Online payment gateway is not enabled on this store.")
  }
  const serviceSupabase = getServiceRoleSupabase()
  if (!serviceSupabase || !isGatewayConfigured(shop.paymentGateway)) {
    return fail("Online payment gateway is temporarily unavailable. Please try again.")
  }

  const supabase = await getServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await serviceSupabase.rpc("get_order_for_gateway", {
    p_code: parsed.data.code,
    p_phone_last4: parsed.data.phoneLast4,
    p_user_id: user?.id ?? null,
  })
  if (error) return fail(mapRpcError(error.message, "Could not start payment."))
  const soft = softRpcError(data)
  if (soft) return fail(soft)

  const row = data as { ok?: boolean; isOwner?: boolean; orderCode?: string; total?: number | string; customerName?: string; phone?: string } | null
  if (!row?.ok || !row.orderCode) return fail("Could not find that order.")

  const isOrderOwner = Boolean(user && row.isOwner === true)
  try {
    const adapter = getGatewayAdapter(shop.paymentGateway)
    const session = await adapter.createOrderSession({
      orderCode: row.orderCode,
      amountInr: Number(row.total ?? 0),
      shopName: shop.shopName,
      customerName: isOrderOwner ? (row.customerName ?? "Customer") : "Customer",
      customerPhone: isOrderOwner ? (row.phone ?? "") : "",
    })
    const { error: sessErr } = await serviceSupabase.rpc("record_gateway_session", {
      p_code: row.orderCode,
      p_gateway: shop.paymentGateway,
      p_gateway_order_id: session.gatewayOrderId,
    })
    if (sessErr) throw sessErr
    return {
      ok: true,
      data: {
        session: isOrderOwner ? session : { ...session, customerName: "", customerPhone: "" },
      },
    }
  } catch {
    return fail("Online payment gateway is temporarily unavailable. Please try again.")
  }
}

/** Verifies the client payment callback signature + server payment state, then confirms the order atomically. */
export async function verifyGatewayPayment(
  input: unknown
): Promise<ActionResult<{ confirmed: boolean; orderCode: string }>> {
  const parsed = verifyGatewayPaymentSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid payment verification payload.")
  if (!isSupabaseConfigured) return fail("Payments are unavailable in demo mode.")
  if (await limited("gateway-payment", parsed.data.code)) return fail(RATE_LIMIT_MESSAGE)

  const shop = await getStoreSettings()
  const serviceSupabase = getServiceRoleSupabase()
  if (!serviceSupabase) {
    return fail("Payment gateway verification is unavailable.")
  }

  const { data: orderRow } = await serviceSupabase
    .from("orders")
    .select("order_code, phone, status, payment_status, payment_reference, payment_gateway, gateway_order_id, total")
    .eq("order_code", parsed.data.code)
    .maybeSingle<{
      order_code: string
      phone: string
      status: string
      payment_status: string
      payment_reference: string | null
      payment_gateway: string | null
      gateway_order_id: string | null
      total: number | string
    }>()

  if (!orderRow || orderRow.phone.slice(-4) !== parsed.data.phoneLast4) {
    return fail("Order not found.")
  }

  const expectedGatewayOrderId = orderRow.gateway_order_id
  if (!expectedGatewayOrderId || expectedGatewayOrderId !== parsed.data.gatewayOrderId) {
    return fail("No active gateway session found for this order.")
  }

  const provider =
    orderRow.payment_gateway === "razorpay" ||
    orderRow.payment_gateway === "cashfree" ||
    orderRow.payment_gateway === "phonepe" ||
    orderRow.payment_gateway === "stripe"
      ? orderRow.payment_gateway
      : shop.paymentGateway

  const adapter = getGatewayAdapter(provider)
  const verified = await adapter.verifyClientPayment({
    expectedGatewayOrderId,
    expectedAmountInr: Number(orderRow.total),
    gatewayOrderId: parsed.data.gatewayOrderId,
    paymentId: parsed.data.paymentId,
    signature: parsed.data.signature,
  })
  if (!verified.ok) {
    return fail(verified.error)
  }

  if (orderRow.payment_status === "paid" || orderRow.payment_status === "refunded") {
    if (orderRow.payment_reference === parsed.data.paymentId) {
      return { ok: true, data: { confirmed: orderRow.status !== "cancelled", orderCode: orderRow.order_code } }
    }
    return fail("This order is already marked as paid.")
  }

  const { data: rpcData, error: rpcError } = await serviceSupabase.rpc("confirm_gateway_payment", {
    p_code: orderRow.order_code,
    p_gateway: provider,
    p_gateway_order_id: expectedGatewayOrderId,
    p_payment_reference: verified.paymentReference,
    p_amount: Number(orderRow.total),
    p_method: verified.method,
  })
  if (rpcError) {
    return fail(mapRpcError(rpcError.message, "Could not confirm your payment. Please contact us on WhatsApp."))
  }

  const out = (rpcData ?? {}) as { confirmed?: boolean; orderCode?: string }
  revalidatePath("/account", "layout")
  revalidatePath("/admin", "layout")
  revalidatePath("/track")
  return { ok: true, data: { confirmed: out.confirmed !== false, orderCode: out.orderCode ?? orderRow.order_code } }
}

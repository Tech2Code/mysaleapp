"use server"

import { z } from "zod"
import { siteConfig } from "@/config/site"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { getActiveProducts } from "@/features/products/queries"
import { placeOrderSchema, trackOrderSchema } from "./schema"
import { buildOrderMessage, shopWhatsappLink } from "./whatsapp"
import type { TrackedOrder } from "./types"

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
}

function mapRpcError(message: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k))
  return key ? RPC_ERRORS[key] : "Could not place your order. Please try again."
}

export type PlacedOrder = { orderCode: string; subtotal: number; whatsappUrl: string }

/**
 * Saves the order (prices are computed by the database, never trusted from the
 * browser) and returns a pre-filled WhatsApp link for the customer to send.
 */
export async function placeOrder(input: unknown): Promise<ActionResult<PlacedOrder>> {
  const parsed = placeOrderSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (!isSupabaseConfigured) {
    return fail("The store is in demo mode — connect Supabase to accept orders (see README).")
  }

  const { customer, items, saveToProfile } = parsed.data
  const phone = normalizeIndianPhone(customer.phone)!
  const supabase = await getServerSupabase()

  const { data, error } = await supabase
    .rpc("create_order", {
      p_customer: { ...customer, phone },
      p_items: items,
      p_prefix: siteConfig.orderCodePrefix,
    })
    .single<{ order_code: string; subtotal: number | string }>()

  if (error || !data) return fail(mapRpcError(error?.message ?? ""))

  const subtotal = Number(data.subtotal)

  // Remember delivery details for logged-in customers (pre-fills next checkout).
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && saveToProfile !== false) {
    await supabase
      .from("profiles")
      .update({
        phone,
        address: customer.address,
        city: customer.city,
        pincode: customer.pincode,
      })
      .eq("id", user.id)
    // Only fill the name if Google didn't give us one.
    await supabase.from("profiles").update({ full_name: customer.name }).eq("id", user.id).is("full_name", null)
  }

  // Build message lines from the same live prices the database used.
  const products = await getActiveProducts()
  const lines = items.flatMap((line) => {
    const p = products.find((x) => x.id === line.productId)
    return p ? [{ name: p.name, price: p.price, quantity: line.quantity }] : []
  })

  const message = buildOrderMessage({
    orderCode: data.order_code,
    customer: { ...customer, phone },
    items: lines,
    subtotal,
  })

  return {
    ok: true,
    data: { orderCode: data.order_code, subtotal, whatsappUrl: shopWhatsappLink(message) },
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

  const t = data as TrackedOrder
  return {
    ok: true,
    data: { ...t, subtotal: Number(t.subtotal), items: t.items.map((i) => ({ ...i, price: Number(i.price) })) },
  }
}

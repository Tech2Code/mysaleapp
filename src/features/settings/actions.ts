"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { isGatewayConfigured } from "@/features/orders/payment-gateway"
import { PAYMENT_GATEWAY_LABEL } from "@/features/orders/types"
import { logAdminAction } from "@/features/security/audit"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { SETTINGS_TAG } from "./queries"
import { parseCustomTheme } from "./theme"
import { createPromoCodeSchema, deletePromoCodeSchema, storeSettingsSchema, togglePromoCodeSchema } from "./schema"

export async function saveStoreSettings(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  const s = parsed.data

  if (s.paymentMode === "gateway" && !isGatewayConfigured(s.paymentGateway)) {
    return fail(
      `${PAYMENT_GATEWAY_LABEL[s.paymentGateway]} server keys aren't configured in environment variables yet. Keep Direct UPI active until keys are added (see payment-gateway-setup.md).`,
      { paymentMode: ["Configure server API keys first"] }
    )
  }

  const supabase = await getServerSupabase()
  const basePayload = {
    shop_name: s.shopName,
    tagline: s.tagline,
    description: s.description,
    seo_keywords: s.keywords || null,
    announcement: s.announcement,
    highlight_line: s.highlightLine,
    hero_badge: s.heroBadge,
    price_note: s.priceNote,
    gst_registered: s.gstRegistered,
    gstin: s.gstin,
    gst_rate: s.gstRate,
    legal_name: s.legalName,
    business_address: s.businessAddress,
    whatsapp_number: s.whatsappNumber,
    contact_email: s.email,
    // a separate calling number is stored only when the toggle is off
    contact_phone: s.phoneSameAsWhatsapp ? null : s.phone,
    phone_same_as_whatsapp: s.phoneSameAsWhatsapp,
    contact_city: s.city,
    contact_region: s.region,
    instagram_url: s.instagramUrl,
    facebook_url: s.facebookUrl,
    order_code_prefix: s.orderCodePrefix,
    unpaid_order_expiry_hours: s.unpaidOrderExpiryHours,
    return_window_days: s.returnWindowDays,
    delivery_fee: s.deliveryFee,
    free_delivery_above: s.freeDeliveryAbove,
    fragile_fee: s.fragileFee,
    oversized_fee: s.oversizedFee,
    free_weight_grams: s.freeWeightGrams,
    extra_weight_fee_per_kg: s.extraWeightFeePerKg,
    payment_mode: s.paymentMode,
    payment_gateway: s.paymentGateway,
    upi_id: s.upiId,
    upi_payee_name: s.upiPayeeName,
  }

  const normalizedCustomTheme = parseCustomTheme(s.themeCustom)
  const withPincodePayload = { ...basePayload, contact_pincode: s.pincode }

  let { data: saved, error } = await supabase
    .from("store_settings")
    .update({
      ...withPincodePayload,
      theme_preset: s.themePreset,
      theme_custom: normalizedCustomTheme,
    })
    .eq("id", true)
    .select("id")

  // Graceful fallback if migration 0078 (theme_preset/theme_custom) is not yet pushed (keep contact_pincode!)
  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message.toLowerCase().includes("theme_preset") ||
      error.message.toLowerCase().includes("theme_custom"))
  ) {
    const retryTheme = await supabase.from("store_settings").update(withPincodePayload).eq("id", true).select("id")
    saved = retryTheme.data
    error = retryTheme.error
  }

  // Graceful fallback if migration 0076 (contact_pincode) is also not yet pushed
  if (
    error &&
    (error.code === "42703" ||
      error.code === "PGRST204" ||
      error.message.toLowerCase().includes("contact_pincode"))
  ) {
    const retryBase = await supabase.from("store_settings").update(basePayload).eq("id", true).select("id")
    saved = retryBase.data
    error = retryBase.error
  }

  if (error) {
    return fail("Could not save settings.")
  }

  if (!saved?.length) return fail("Settings row not found.")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "settings.update",
    targetType: "settings",
    targetId: "store_settings",
    metadata: { shopName: s.shopName, paymentMode: s.paymentMode, paymentGateway: s.paymentGateway, upiId: s.upiId, deliveryFee: s.deliveryFee },
  })

  // The name, contact details etc. appear on every page, so refresh the whole site.
  updateTag(SETTINGS_TAG)
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function createPromoCode(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = createPromoCodeSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  const p = parsed.data

  const supabase = await getServerSupabase()
  const { data: created, error } = await supabase
    .from("promo_codes")
    .insert({
      code: p.code,
      description: p.description,
      discount_type: p.discountType,
      discount_value: p.discountValue,
      min_order_amount: p.minOrderAmount,
      max_discount_amount: p.discountType === "percent" ? p.maxDiscountAmount : null,
      max_uses: p.maxUses,
      expires_at: p.expiresAt,
      is_active: true,
    })
    .select("id, code")
    .maybeSingle<{ id: string; code: string }>()

  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate") || error.message.toLowerCase().includes("unique")) {
      return fail("That promo code already exists.", { code: ["A promo code with this code already exists"] })
    }
    return fail("Could not create promo code. Please try again.")
  }

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "promo_code.create",
    targetType: "promo_code",
    targetId: created?.id ?? p.code,
    metadata: {
      code: p.code,
      discountType: p.discountType,
      discountValue: p.discountValue,
      minOrderAmount: p.minOrderAmount,
    },
  })

  revalidatePath("/admin/settings")
  revalidatePath("/checkout")
  return { ok: true }
}

export async function togglePromoCode(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = togglePromoCodeSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid promo code request.")

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("promo_codes")
    .update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .select("id, code")
    .maybeSingle<{ id: string; code: string }>()

  if (error || !data) return fail("Could not update promo code status.")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: parsed.data.isActive ? "promo_code.enable" : "promo_code.disable",
    targetType: "promo_code",
    targetId: data.id,
    metadata: { code: data.code, isActive: parsed.data.isActive },
  })

  revalidatePath("/admin/settings")
  revalidatePath("/checkout")
  return { ok: true }
}

export async function deletePromoCode(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = deletePromoCodeSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid promo code request.")

  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("promo_codes")
    .delete()
    .eq("id", parsed.data.id)
    .select("id, code")
    .maybeSingle<{ id: string; code: string }>()

  if (error || !data) return fail("Could not delete promo code.")

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "promo_code.delete",
    targetType: "promo_code",
    targetId: data.id,
    metadata: { code: data.code },
  })

  revalidatePath("/admin/settings")
  revalidatePath("/checkout")
  return { ok: true }
}

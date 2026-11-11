import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { getPublicSupabase } from "@/lib/supabase/public"
import { formatPhoneDisplay } from "@/lib/format"
import { DEFAULT_SETTINGS } from "./defaults"
import type { StoreSettings } from "./types"

export const SETTINGS_TAG = "settings"

type SettingsRow = {
  delivery_fee: number | string
  free_delivery_above: number | string
  fragile_fee?: number | string | null
  oversized_fee?: number | string | null
  free_weight_grams?: number | null
  extra_weight_fee_per_kg?: number | string | null
  unpaid_order_expiry_hours: number | null
  return_window_days: number | null
  upi_id: string | null
  upi_payee_name: string | null
  shop_name: string | null
  tagline: string | null
  description: string | null
  seo_keywords: string | null
  announcement: string | null
  highlight_line: string | null
  hero_badge: string | null
  price_note: string | null
  gst_registered: boolean | null
  gstin: string | null
  gst_rate: number | string | null
  legal_name: string | null
  business_address: string | null
  whatsapp_number: string | null
  contact_email: string | null
  contact_phone: string | null
  phone_same_as_whatsapp: boolean | null
  contact_city: string | null
  contact_region: string | null
  instagram_url: string | null
  facebook_url: string | null
  order_code_prefix: string | null
}

/**
 * All owner-editable settings. Cached; refreshed instantly when the admin saves Settings.
 * Required text falls back to the defaults in ./defaults.ts until set; optional details
 * (email, social links…) are simply hidden when empty.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache"
  cacheLife("hours")
  cacheTag(SETTINGS_TAG)

  const d = DEFAULT_SETTINGS
  const supabase = getPublicSupabase()
  if (!supabase) return d

  const { data, error } = await supabase.from("store_settings").select("*").maybeSingle<SettingsRow>()
  if (error) {
    // Transient DB error: do not poison the hours-long cache with fallback placeholder settings.
    cacheLife("seconds")
    return d
  }
  if (!data) return d

  const keywords = (data.seo_keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)

  const whatsappNumber = data.whatsapp_number ?? d.whatsappNumber
  const phoneSame = data.phone_same_as_whatsapp ?? true

  return {
    shopName: data.shop_name ?? d.shopName,
    tagline: data.tagline ?? d.tagline,
    description: data.description ?? d.description,
    keywords: keywords.length ? keywords : d.keywords,
    announcement: data.announcement,
    highlightLine: data.highlight_line ?? d.highlightLine,
    heroBadge: data.hero_badge ?? d.heroBadge,
    priceNote: data.price_note,
    gstRegistered: data.gst_registered ?? false,
    gstin: data.gstin,
    gstRate: Number(data.gst_rate ?? 0),
    legalName: data.legal_name,
    businessAddress: data.business_address,
    whatsappNumber,
    email: data.contact_email,
    phone: phoneSame ? formatPhoneDisplay(whatsappNumber) : data.contact_phone,
    phoneSameAsWhatsapp: phoneSame,
    city: data.contact_city,
    region: data.contact_region,
    instagramUrl: data.instagram_url,
    facebookUrl: data.facebook_url,
    orderCodePrefix: data.order_code_prefix ?? d.orderCodePrefix,
    unpaidOrderExpiryHours: Number(data.unpaid_order_expiry_hours ?? d.unpaidOrderExpiryHours),
    returnWindowDays: Number(data.return_window_days ?? d.returnWindowDays),
    deliveryFee: Number(data.delivery_fee),
    freeDeliveryAbove: Number(data.free_delivery_above),
    fragileFee: Number(data.fragile_fee ?? d.fragileFee),
    oversizedFee: Number(data.oversized_fee ?? d.oversizedFee),
    freeWeightGrams: Number(data.free_weight_grams ?? d.freeWeightGrams),
    extraWeightFeePerKg: Number(data.extra_weight_fee_per_kg ?? d.extraWeightFeePerKg),
    upiId: data.upi_id,
    upiPayeeName: data.upi_payee_name,
  }
}

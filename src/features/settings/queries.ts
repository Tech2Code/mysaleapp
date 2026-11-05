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
  unpaid_order_expiry_hours: number | null
  return_window_days: number | null
  upi_id: string | null
  upi_payee_name: string | null
  shop_name: string | null
  tagline: string | null
  description: string | null
  seo_keywords: string | null
  announcement: string | null
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

const COLUMNS =
  "delivery_fee, free_delivery_above, unpaid_order_expiry_hours, return_window_days, upi_id, upi_payee_name, shop_name, tagline, description, seo_keywords, " +
  "announcement, whatsapp_number, contact_email, contact_phone, phone_same_as_whatsapp, contact_city, contact_region, instagram_url, " +
  "facebook_url, order_code_prefix"

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

  const { data, error } = await supabase.from("store_settings").select(COLUMNS).maybeSingle<SettingsRow>()
  // table or columns missing (migrations not applied yet) → keep the site working with defaults
  if (error || !data) return d

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
    upiId: data.upi_id,
    upiPayeeName: data.upi_payee_name,
  }
}

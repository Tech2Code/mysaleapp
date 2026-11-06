"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { SETTINGS_TAG } from "./queries"
import { storeSettingsSchema } from "./schema"

export async function saveStoreSettings(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = storeSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  const s = parsed.data

  const supabase = await getServerSupabase()
  const { data: saved, error } = await supabase
    .from("store_settings")
    .update({
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
      upi_id: s.upiId,
      upi_payee_name: s.upiPayeeName,
    })
    .eq("id", true)
    .select("id")

  if (error) {
    return fail("Could not save settings.")
  }

  if (!saved?.length) return fail("Settings row not found.")

  // The name, contact details etc. appear on every page, so refresh the whole site.
  updateTag(SETTINGS_TAG)
  revalidatePath("/", "layout")
  return { ok: true }
}

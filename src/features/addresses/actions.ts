"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { getServerSupabase } from "@/lib/supabase/server"
import { addressSchema } from "./schema"
import { mapAddress, type Address, type AddressRow } from "./types"

const COLUMNS = "id, label, full_name, phone, address, city, pincode, is_default"

/** The signed-in customer's saved addresses, default first. Empty for guests. */
export async function listMyAddresses(): Promise<Address[]> {
  const user = await getCurrentUser()
  if (!user) return []
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from("addresses")
    .select(COLUMNS)
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .returns<AddressRow[]>()
  return (data ?? []).map(mapAddress)
}

/** Creates (id = null) or updates an address. RLS also restricts rows to the owner. */
export async function saveAddress(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Please sign in again.")

  const parsed = addressSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  if (id !== null && !z.uuid().safeParse(id).success) return fail("Invalid address")

  const a = parsed.data
  const supabase = await getServerSupabase()

  // The database allows only one default, so clear the old one first.
  if (a.isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true)
  }

  const row = {
    label: a.label,
    full_name: a.fullName,
    phone: normalizeIndianPhone(a.phone)!,
    address: a.address,
    city: a.city,
    pincode: a.pincode,
    is_default: a.isDefault,
  }

  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id).eq("user_id", user.id)
    : await supabase.from("addresses").insert({ ...row, user_id: user.id })

  if (error) {
    if (error.message.includes("ADDRESS_LIMIT")) return fail("You can save up to 10 addresses. Delete one to add another.")
    if (error.code === "42P01" || error.code === "PGRST205") {
      return fail("Address book isn't set up yet. Apply the latest database migrations (npm run db:push).")
    }
    return fail("Could not save the address.")
  }

  revalidatePath("/account", "layout")
  return { ok: true }
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Please sign in again.")
  if (!z.uuid().safeParse(id).success) return fail("Invalid address")

  const supabase = await getServerSupabase()
  const { error } = await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id)
  if (error) return fail("Could not delete the address.")

  revalidatePath("/account", "layout")
  return { ok: true }
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Please sign in again.")
  if (!z.uuid().safeParse(id).success) return fail("Invalid address")

  const supabase = await getServerSupabase()
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).eq("is_default", true)
  const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id).eq("user_id", user.id)
  if (error) return fail("Could not set the default address.")

  revalidatePath("/account", "layout")
  return { ok: true }
}

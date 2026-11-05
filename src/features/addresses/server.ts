import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { MAX_ADDRESSES } from "./types"

/**
 * Saves the address a customer just ordered with into their address book,
 * unless they already have it or the book is full. Never throws: a failure here
 * must not affect the order that was already placed.
 */
export async function addAddressFromOrder(
  supabase: SupabaseClient,
  userId: string,
  a: { name: string; phone: string; address: string; city: string; pincode: string }
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("addresses")
      .select("address, pincode")
      .eq("user_id", userId)
      .returns<{ address: string; pincode: string }[]>()

    const rows = existing ?? []
    if (rows.length >= MAX_ADDRESSES) return
    const key = (address: string, pincode: string) => `${address.trim().toLowerCase()}|${pincode}`
    if (rows.some((r) => key(r.address, r.pincode) === key(a.address, a.pincode))) return

    await supabase.from("addresses").insert({
      user_id: userId,
      label: rows.length === 0 ? "Home" : "Other",
      full_name: a.name,
      phone: a.phone,
      address: a.address,
      city: a.city,
      pincode: a.pincode,
      is_default: rows.length === 0,
    })
  } catch {
    // ignore: the address book is a convenience
  }
}

"use server"

import { z } from "zod"
import { getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"

const idList = z.array(z.uuid()).max(200)

async function readIds(userId: string): Promise<string[]> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((r) => r.product_id as string)
}

/**
 * Called once after login: adds the guest's local wishlist to the account
 * (duplicates ignored) and returns the full, merged list from the database.
 */
export async function syncWishlist(localIds: unknown): Promise<ActionResult<string[]>> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = idList.safeParse(localIds)
  const ids = parsed.success ? parsed.data : []

  if (ids.length) {
    const supabase = await getServerSupabase()
    const { error } = await supabase
      .from("wishlists")
      .upsert(
        ids.map((product_id) => ({ user_id: user.id, product_id })),
        { onConflict: "user_id,product_id", ignoreDuplicates: true }
      )
    // A deleted product id would violate the FK; ignore and return what's saved.
    if (error && error.code !== "23503") return fail("Could not sync wishlist")
  }

  return { ok: true, data: await readIds(user.id) }
}

export async function setWishlisted(productId: unknown, on: boolean): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = z.uuid().safeParse(productId)
  if (!parsed.success) return fail("Invalid product")

  const supabase = await getServerSupabase()
  const { error } = on
    ? await supabase
        .from("wishlists")
        .upsert({ user_id: user.id, product_id: parsed.data }, { ignoreDuplicates: true })
    : await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", parsed.data)

  if (error) return fail("Could not update wishlist")
  return { ok: true }
}

"use server"

import { z } from "zod"
import { getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"

const uuidItem = z.uuid()

async function readIds(userId: string): Promise<ActionResult<string[]>> {
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("wishlists")
    .select("product_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) return fail("Could not sync wishlist")
  return { ok: true, data: data.map((r) => r.product_id as string) }
}

/**
 * Called once after login: adds the guest's local wishlist to the account
 * (duplicates ignored) and returns the full, merged list from the database.
 */
export async function syncWishlist(localIds: unknown): Promise<ActionResult<string[]>> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const rawList = Array.isArray(localIds) ? localIds.slice(0, 200) : []
  const candidateIds = Array.from(new Set(rawList.filter((x): x is string => uuidItem.safeParse(x).success)))

  if (candidateIds.length) {
    const supabase = await getServerSupabase()
    // Intersect with existing products first so one deleted product doesn't abort the batch upsert.
    const { data: existingProducts, error: checkError } = await supabase
      .from("products")
      .select("id")
      .in("id", candidateIds)
    if (checkError) return fail("Could not sync wishlist")
    const validIds = (existingProducts ?? []).map((p) => p.id as string)
    if (validIds.length) {
      const { error } = await supabase
        .from("wishlists")
        .upsert(
          validIds.map((product_id) => ({ user_id: user.id, product_id })),
          { onConflict: "user_id,product_id", ignoreDuplicates: true }
        )
      if (error && error.code !== "23503") return fail("Could not sync wishlist")
    }
  }

  return readIds(user.id)
}

export async function setWishlisted(productId: unknown, on: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = uuidItem.safeParse(productId)
  const parsedOn = z.boolean().safeParse(on)
  if (!parsed.success || !parsedOn.success) return fail("Invalid product")

  const supabase = await getServerSupabase()
  const { error } = parsedOn.data
    ? await supabase
        .from("wishlists")
        .upsert({ user_id: user.id, product_id: parsed.data }, { ignoreDuplicates: true })
    : await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", parsed.data)

  if (error) return fail("Could not update wishlist")
  return { ok: true }
}

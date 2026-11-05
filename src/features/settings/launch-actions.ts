"use server"

import { revalidatePath, updateTag } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { CACHE_TAGS } from "@/features/products/queries"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { resetSchema, type LaunchCounts } from "./launch"

const BUCKET = "product-images"

/** All file paths in the bucket, folder by folder (Storage has no "list everything" call). */
async function listAllPaths(supabase: Awaited<ReturnType<typeof getServerSupabase>>, prefix = "", depth = 0): Promise<string[]> {
  if (depth > 4) return []
  const { data } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  const paths: string[] = []
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id === null) paths.push(...(await listAllPaths(supabase, full, depth + 1))) // folder
    else paths.push(full)
  }
  return paths
}

/**
 * Wipe test data so the shop can launch clean. Admin only, and the caller must type the confirm word.
 * Settings (shop details, UPI, etc.) and the admin account are never touched.
 */
export async function resetStoreData(input: unknown): Promise<ActionResult<LaunchCounts & { images: number }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return fail("Please confirm what to clear.", z.flattenError(parsed.error).fieldErrors)
  const { scopes } = parsed.data

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("admin_reset_data", { p_scopes: scopes })
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return fail("The reset function is missing. Run the latest database migrations (npm run db:push).")
    }
    return fail("Could not clear the data. Nothing was deleted.")
  }

  let images = 0
  if (scopes.includes("catalog")) {
    const paths = await listAllPaths(supabase)
    for (let i = 0; i < paths.length; i += 100) {
      const { error: rmError } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
      if (!rmError) images += Math.min(100, paths.length - i)
    }
    updateTag(CACHE_TAGS.products)
    updateTag(CACHE_TAGS.categories)
  }

  revalidatePath("/", "layout")
  const r = data as Partial<LaunchCounts>
  return {
    ok: true,
    data: {
      orders: r.orders ?? 0,
      products: r.products ?? 0,
      categories: r.categories ?? 0,
      addresses: r.addresses ?? 0,
      wishlists: r.wishlists ?? 0,
      images,
    },
  }
}

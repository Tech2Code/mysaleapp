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
async function listAllPaths(supabase: Awaited<ReturnType<typeof getServerSupabase>>, prefix = "", depth = 0): Promise<{ paths: string[]; failed: boolean }> {
  if (depth > 4) return { paths: [], failed: false }
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) return { paths: [], failed: true }
  const paths: string[] = []
  let failed = false
  for (const entry of data ?? []) {
    const full = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.id === null) {
      const sub = await listAllPaths(supabase, full, depth + 1) // folder
      paths.push(...sub.paths)
      failed ||= sub.failed
    } else paths.push(full)
  }
  return { paths, failed }
}

/**
 * Wipe test data so the shop can launch clean. Admin only, and the caller must type the confirm word.
 * Settings (shop details, UPI, etc.) and the admin account are never touched.
 */
export async function resetStoreData(input: unknown): Promise<ActionResult<LaunchCounts & { images: number; imagesFailed: number; imagesUnlisted: boolean }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return fail("Please confirm what to clear.", z.flattenError(parsed.error).fieldErrors)
  const { scopes } = parsed.data

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("admin_reset_data", { p_scopes: scopes })
  if (error) {
    return fail("Could not clear the data. Nothing was deleted.")
  }

  let images = 0
  let imagesFailed = 0
  let imagesUnlisted = false
  if (scopes.includes("catalog")) {
    const listing = await listAllPaths(supabase)
    imagesUnlisted = listing.failed
    const paths = listing.paths
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100)
      const { data: removed, error: rmError } = await supabase.storage.from(BUCKET).remove(batch)
      const ok = rmError ? 0 : Math.min(removed?.length ?? batch.length, batch.length)
      images += ok
      imagesFailed += batch.length - ok
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
      imagesFailed,
      imagesUnlisted,
    },
  }
}

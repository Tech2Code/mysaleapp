import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Data Access Layer for auth. Every protected page AND every Server Action
 * calls one of these — the proxy redirect is only an optimistic UX shortcut.
 */

// cache() de-duplicates within ONE request (layout + page + queries each call these), so the
// admin panel pays for one auth round trip instead of one per component.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured) return null
  const supabase = await getServerSupabase()
  const { data } = await supabase.auth.getUser()
  return data.user
})

export async function requireUser(nextPath = "/account"): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return user
}

export const isAdminUser = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured) return false
  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("is_admin")
  return !error && data === true
})

export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) redirect("/admin/login")
  if (!(await isAdminUser())) redirect("/admin/login?error=not-admin")
  return user
}

/** For Server Actions: returns an error result instead of redirecting. */
export async function assertAdmin(): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const user = await getCurrentUser()
  if (!user || !(await isAdminUser())) return { ok: false, error: "Not authorised" }
  return { ok: true, user }
}

import "server-only"
import { cache } from "react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  ADMIN_PIN_WINDOW_MS,
  ADMIN_SESSION_MAX_AGE_MS,
  type AdminPinMode,
  type AdminPinStatus,
} from "./account-schema"

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

export async function requireUser(nextPath = "/account/orders"): Promise<User> {
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

type RpcPinState = {
  mode?: string
  hasPin?: boolean
  updatedAt?: string | null
  lockedUntil?: string | null
}

/** Reads the signed-in admin's 4-digit PIN configuration and 12-hour unlock timestamp (cached per request). */
export const getAdminPinStatus = cache(async (): Promise<AdminPinStatus> => {
  const fallback: AdminPinStatus = {
    mode: "unset",
    hasPin: false,
    updatedAt: null,
    lockedUntil: null,
    unlockedAt: 0,
    manualLock: false,
  }
  if (!isSupabaseConfigured) return fallback
  const user = await getCurrentUser()
  if (!user) return fallback

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const { data } = await supabase.rpc("get_admin_pin_state")
  const raw = (data ?? {}) as RpcPinState
  const mode: AdminPinMode =
    raw.mode === "enabled" || raw.mode === "disabled" ? raw.mode : "unset"

  const cookieVal = cookieStore.get("kk_admin_pin_at")?.value
  const manualLock = cookieVal === "locked"
  const signedInMs = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0
  const cookieMs = cookieVal && !manualLock ? Number(cookieVal) : NaN
  const unlockedAt = manualLock
    ? 0
    : Number.isFinite(cookieMs) && cookieMs > 0
      ? Math.max(cookieMs, Number.isFinite(signedInMs) ? signedInMs : 0)
      : Number.isFinite(signedInMs) && signedInMs > 0
        ? signedInMs
        : 0

  return {
    mode,
    hasPin: Boolean(raw.hasPin),
    updatedAt: raw.updatedAt ?? null,
    lockedUntil: raw.lockedUntil ?? null,
    unlockedAt,
    manualLock,
  }
})

function isAdminSessionExpired(user: User): boolean {
  const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN
  return !Number.isNaN(signedInAt) && Date.now() - signedInAt >= ADMIN_SESSION_MAX_AGE_MS
}

async function isAdminPinLocked(): Promise<boolean> {
  const pin = await getAdminPinStatus()
  if (pin.mode !== "enabled" || !pin.hasPin) return false
  if (pin.manualLock) return true
  return !pin.unlockedAt || Date.now() - pin.unlockedAt >= ADMIN_PIN_WINDOW_MS
}

export async function requireAdmin(): Promise<User> {
  const [user, admin, cookieStore] = await Promise.all([getCurrentUser(), isAdminUser(), cookies()])
  if (!user || !admin) redirect("/admin/login")
  if (cookieStore.get("kk_pw_reset")?.value === "1") {
    redirect("/admin/reset-password")
  }
  if (isAdminSessionExpired(user)) {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()
    cookieStore.delete("kk_admin_pin_at")
    redirect("/admin/login?reason=session-expired")
  }
  return user
}

/** For Server Actions: returns an error result instead of redirecting. */
export async function assertAdmin(options?: {
  allowWhenPinLocked?: boolean
}): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const [user, admin, cookieStore] = await Promise.all([getCurrentUser(), isAdminUser(), cookies()])
  if (!user || !admin) return { ok: false, error: "Not authorised" }
  if (cookieStore.get("kk_pw_reset")?.value === "1") {
    return { ok: false, error: "Please finish setting your new password first." }
  }
  if (isAdminSessionExpired(user)) {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()
    cookieStore.delete("kk_admin_pin_at")
    return { ok: false, error: "Your 7-day admin session has expired. Please sign in again." }
  }
  if (!options?.allowWhenPinLocked && (await isAdminPinLocked())) {
    return { ok: false, error: "Admin screen is locked. Enter your 4-digit PIN to continue." }
  }
  return { ok: true, user }
}

"use server"

// Admin account: login email, password change and reset. The customer's profile lives in features/account.

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { assertAdmin, getCurrentUser, isAdminUser } from "@/features/auth/guards"
import { siteConfig } from "@/config/site"
import { fail, type ActionResult } from "@/lib/action-result"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  changePasswordSchema,
  changePinSchema,
  emailSchema,
  profileSchema,
  resetSchema,
  setPinSchema,
  unlockPinWithPasswordSchema,
  verifyPinSchema,
  type AdminPinMode,
} from "./account-schema"

/**
 * Admin account management: profile, email, password, and the "forgot password" flow.
 * Emails (confirmation / reset link) are sent by Supabase Auth; see README → "Admin account emails".
 */

/**
 * Base URL for links inside auth emails. In production this is the configured site URL, never a
 * request header, so a forged Origin/Host can't point a reset link at another site. The request
 * Origin is only used as a fallback in local development; in production a missing
 * NEXT_PUBLIC_SITE_URL yields no redirect override (Supabase falls back to its own Site URL).
 */
async function trustedOrigin(): Promise<string | undefined> {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url)) return siteConfig.url
  if (process.env.NEXT_PUBLIC_SITE_URL) return siteConfig.url
  if (process.env.NODE_ENV === "production") return undefined
  return (await headers()).get("origin") ?? undefined
}

export async function updateAdminProfile(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const supabase = await getServerSupabase()
  const { error } = await supabase.from("profiles").upsert({
    id: auth.user.id,
    full_name: parsed.data.name,
    phone: parsed.data.phone ?? null,
  })
  if (error) return fail("Could not save your details. Please try again.")
  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Supabase emails a confirmation link to the NEW address; the login email changes once it is clicked. */
export async function requestAdminEmailChange(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)
  if (parsed.data.email.toLowerCase() === auth.user.email?.toLowerCase()) return fail("That is already your email address.")
  if (await limited("password-reset", auth.user.id)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const origin = await trustedOrigin()
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/admin/account?email_changed=1")}` } : undefined
  )
  if (error) {
    return fail(error.message.toLowerCase().includes("already") ? "That email is already used by another account." : "Could not change the email. Please try again.")
  }
  return { ok: true }
}

/** Re-checks the current password first, so a borrowed, unlocked laptop can't be used to take over the account. */
export async function changeAdminPassword(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = changePasswordSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  if (!auth.user.email) return fail("This account has no email to verify with.")
  if (await limited("login", auth.user.email)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const check = await supabase.auth.signInWithPassword({ email: auth.user.email, password: parsed.data.current })
  if (check.error) return fail("Your current password is incorrect.", { current: ["Incorrect password"] })

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) return fail("Could not change the password. Please try again.")
  await supabase.rpc("clear_admin_pin_lock")
  await stampAdminPinUnlock(String(Date.now()))
  return { ok: true }
}

/** Public: sends a reset link. Always answers the same, so it can't be used to find out which emails are admins. */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)

  // Per IP + email, so the endpoint can't be used to flood someone's inbox with reset mails.
  if (await limited("password-reset", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const origin = await trustedOrigin()
  const supabase = await getServerSupabase()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/auth/callback?next=/admin/reset-password` : undefined,
  })
  return { ok: true }
}

/** Step 2 of "forgot password": the reset link signed the person in; they now choose a new password. */
export async function resetAdminPassword(input: unknown): Promise<ActionResult> {
  const cookieStore = await cookies()
  if (cookieStore.get("kk_pw_reset")?.value !== "1") {
    return fail("This reset link has expired. Please request a new one.")
  }
  const user = await getCurrentUser()
  if (!user) return fail("This reset link has expired. Please request a new one.")
  if (!(await isAdminUser())) return fail("Not authorised")
  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) return fail("Could not set the new password. Please request a new reset link.")
  await supabase.rpc("clear_admin_pin_lock")
  cookieStore.delete("kk_pw_reset")
  cookieStore.set("kk_admin_pin_at", String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  })
  redirect("/admin")
}

const PIN_COOKIE_NAME = "kk_admin_pin_at"
const PIN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60

async function stampAdminPinUnlock(value = String(Date.now())) {
  const cookieStore = await cookies()
  cookieStore.set(PIN_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PIN_COOKIE_MAX_AGE,
    path: "/",
  })
}

type RpcPinState = {
  mode?: string
  hasPin?: boolean
}

/** Sets a new 4-digit PIN (when none was set or when re-enabling PIN lock). */
export async function setAdminPin(input: unknown): Promise<ActionResult<{ unlockedAt: number }>> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  const parsed = setPinSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const supabase = await getServerSupabase()
  const { error } = await supabase.rpc("set_admin_pin", { p_pin: parsed.data.pin })
  if (error) return fail("Could not save your PIN. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(String(now))
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

/** Changes an existing 4-digit PIN (verifies either the current PIN or the account password first). */
export async function changeAdminPin(input: unknown): Promise<ActionResult<{ unlockedAt: number }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = changePinSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  if (await limited("login", auth.user.id)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()

  if (parsed.data.authMethod === "pin") {
    const { data: verifyRes, error: verifyErr } = await supabase.rpc("verify_admin_pin", {
      p_pin: parsed.data.currentPin ?? "",
    })
    const resObj = (verifyRes ?? {}) as { ok?: boolean; error?: string }
    if (verifyErr || !resObj.ok) {
      return fail(resObj.error || "Current PIN is incorrect.", {
        currentPin: [resObj.error || "Incorrect PIN"],
      })
    }
  } else {
    if (!auth.user.email) return fail("This account has no email to verify with.")
    const check = await supabase.auth.signInWithPassword({
      email: auth.user.email,
      password: parsed.data.password ?? "",
    })
    if (check.error) {
      return fail("Your account password is incorrect.", {
        password: ["Incorrect password"],
      })
    }
  }

  const { error } = await supabase.rpc("set_admin_pin", { p_pin: parsed.data.next })
  if (error) return fail("Could not update your PIN. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(String(now))
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

/**
 * Turns off / removes the 4-digit PIN ("Don't use PIN").
 * When called while a PIN is enabled, requires either the current PIN or the account password;
 * when called from the first-time 12h prompt (`mode === "unset"`), disables immediately.
 */
export async function disableAdminPin(input?: unknown): Promise<ActionResult<{ unlockedAt: number }>> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  if (await limited("login", auth.user.id)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data: stateData } = await supabase.rpc("get_admin_pin_state")
  const state = (stateData ?? {}) as RpcPinState

  if (state.mode === "enabled" && state.hasPin) {
    const body = (input && typeof input === "object" ? input : {}) as {
      currentPin?: string
      password?: string
    }
    const pinCandidate = (body.currentPin ?? "").trim()
    const pwCandidate = body.password ?? ""
    if (pinCandidate) {
      const { data: verifyRes, error: verifyErr } = await supabase.rpc("verify_admin_pin", {
        p_pin: pinCandidate,
      })
      const resObj = (verifyRes ?? {}) as { ok?: boolean; error?: string }
      if (verifyErr || !resObj.ok) {
        return fail(resObj.error || "Current PIN is incorrect.", {
          currentPin: [resObj.error || "Incorrect PIN"],
        })
      }
    } else if (pwCandidate) {
      if (!auth.user.email) return fail("This account has no email to verify with.")
      const check = await supabase.auth.signInWithPassword({
        email: auth.user.email,
        password: pwCandidate,
      })
      if (check.error) {
        return fail("Your account password is incorrect.", {
          password: ["Incorrect password"],
        })
      }
    } else {
      return fail("Enter your current PIN or account password to turn off PIN lock.")
    }
  }

  const { error } = await supabase.rpc("disable_admin_pin")
  if (error) return fail("Could not turn off PIN lock. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(String(now))
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

/** Verifies the 4-digit PIN on the lock screen and starts a fresh 12-hour unlock window. */
export async function verifyAdminPin(
  input: unknown
): Promise<ActionResult<{ unlockedAt: number }>> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  const parsed = verifyPinSchema.safeParse(input)
  if (!parsed.success) return fail("Enter your 4-digit PIN.")
  if (await limited("login", auth.user.id)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.rpc("verify_admin_pin", { p_pin: parsed.data.pin })
  if (error) return fail("Could not verify PIN. Please try again.")

  const res = (data ?? {}) as { ok?: boolean; error?: string }
  if (!res.ok) {
    return fail(res.error || "Incorrect PIN.")
  }

  const now = Date.now()
  await stampAdminPinUnlock(String(now))
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

/** "Forgot PIN?": verifies the admin's account password to unlock, set a new PIN, or turn PIN off. */
export async function unlockAdminWithPassword(
  input: unknown
): Promise<ActionResult<{ unlockedAt: number; mode: AdminPinMode }>> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  const parsed = unlockPinWithPasswordSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  if (!auth.user.email) return fail("This account has no email to verify with.")
  if (await limited("login", auth.user.email)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const check = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: parsed.data.password,
  })
  if (check.error) {
    return fail("Incorrect account password.", { password: ["Incorrect password"] })
  }

  let nextMode: AdminPinMode = "enabled"
  if (parsed.data.action === "reset" && parsed.data.newPin) {
    const { error } = await supabase.rpc("set_admin_pin", { p_pin: parsed.data.newPin })
    if (error) return fail("Could not save new PIN. Please try again.")
    nextMode = "enabled"
  } else if (parsed.data.action === "disable") {
    const { error } = await supabase.rpc("disable_admin_pin")
    if (error) return fail("Could not turn off PIN lock. Please try again.")
    nextMode = "disabled"
  } else {
    await supabase.rpc("clear_admin_pin_lock")
  }

  const now = Date.now()
  await stampAdminPinUnlock(String(now))
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now, mode: nextMode } }
}

/** Immediately locks the admin panel with the 4-digit PIN screen ("Lock now"). */
export async function lockAdminScreen(): Promise<ActionResult> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  await stampAdminPinUnlock("locked")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

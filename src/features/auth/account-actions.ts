"use server"

// Admin account: login email, password change and reset. The customer's profile lives in features/account.

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import {
  assertAdmin,
  getCurrentUser,
  hasValidPasswordResetCookie,
  isAdminUser,
  signAdminPinCookie,
} from "@/features/auth/guards"
import { siteConfig } from "@/config/site"
import { generateResetToken, getServerRpcSecret, hashResetToken } from "@/features/email/crypto"
import { resolveMailerPayload, sendEmailWithGmailSmtp, type EncryptedMailerPayload } from "@/features/email/mailer"
import { buildPasswordChangedEmail, buildPasswordResetEmail } from "@/features/email/templates"
import { getStoreSettings } from "@/features/settings/queries"
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
    const msg = error.message.toLowerCase()
    const code = error.code ?? ""
    if (msg.includes("already") || msg.includes("registered") || code === "email_exists") {
      return fail("That email is already used by another account.", {
        email: ["That email is already used by another account."],
      })
    }
    if (
      msg.includes("rate limit") ||
      msg.includes("once every") ||
      msg.includes("security purposes") ||
      code === "over_email_send_rate_limit" ||
      code === "over_request_rate_limit"
    ) {
      return fail(
        "Email limit reached on Supabase's free mail sender (or 60-second cooldown). Please wait a few minutes before changing your email again."
      )
    }
    if (code === "email_address_invalid" || (msg.includes("invalid") && msg.includes("email"))) {
      return fail("Please enter a valid, real email address (test domains like @example.com are blocked by Supabase).", {
        email: ["Enter a valid, deliverable email address."],
      })
    }
    if (code === "email_address_not_authorized" || msg.includes("not authorized")) {
      return fail(
        "This email address isn't authorised on Supabase's default mail sender yet. Configure Custom SMTP in Supabase → Authentication → Emails, or use an authorised email."
      )
    }
    if (msg.includes("error sending") || msg.includes("smtp") || code === "unexpected_failure") {
      return fail(
        "Supabase could not send the confirmation email (free mail sender quota or SMTP issue). Please try again later."
      )
    }
    return fail("Could not change the email. Please try again.")
  }
  return { ok: true }
}

/** Re-checks the current password first, so a borrowed, unlocked laptop can't be used to take over the account. */
export async function changeAdminPassword(
  input: unknown
): Promise<ActionResult<{ unlockedAt: number }>> {
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
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("different") || msg.includes("same") || error.code === "same_password") {
      return fail("Use a new password, not your current one.", {
        next: ["Use a new password, not your current one"],
      })
    }
    return fail("Could not change the password. Please try again.")
  }
  await supabase.rpc("clear_admin_pin_lock")
  const now = Date.now()
  await stampAdminPinUnlock(auth.user.id, now)
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

type AdminResetTokenRpc = {
  smtpEnabled?: boolean
  found?: boolean
  email?: string
  recipientName?: string | null
  mailer?: EncryptedMailerPayload | null
}

type AdminConsumeTokenRpc = {
  ok?: boolean
  code?: string
  userId?: string
  email?: string
  recipientName?: string | null
  mailer?: EncryptedMailerPayload | null
}

const adminResetWithTokenSchema = resetSchema.safeExtend({
  token: z.string().trim().min(32).max(128).optional(),
})

/** Public: sends a reset link only if the email belongs to an admin. Always answers the same so it can't be used to enumerate admin emails. */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)

  // Per IP + email, so the endpoint can't be used to flood someone's inbox with reset mails.
  if (await limited("password-reset", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const [origin, cookieStore, supabase] = await Promise.all([
    trustedOrigin(),
    cookies(),
    getServerSupabase(),
  ])
  const baseUrl = origin ?? siteConfig.url

  // Try Gmail SMTP one-time token flow first (active when Admin → Settings → Gmail SMTP is enabled)
  const rawToken = generateResetToken()
  const tokenHash = hashResetToken(rawToken)
  const { data: rpcData, error: rpcErr } = await supabase.rpc("create_password_reset_token", {
    p_email: parsed.data.email,
    p_scope: "admin",
    p_token_hash: tokenHash,
    p_server_secret: getServerRpcSecret(),
    p_ttl_minutes: 30,
  })
  const tokenRes = (!rpcErr && rpcData ? rpcData : null) as AdminResetTokenRpc | null

  if (tokenRes?.smtpEnabled) {
    if (!tokenRes.found || !tokenRes.email) {
      return { ok: true }
    }
    const smtp = resolveMailerPayload(tokenRes.mailer)
    if (!smtp) {
      return fail("Email service is misconfigured. Please check Gmail SMTP settings.")
    }
    const shop = await getStoreSettings()
    const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(rawToken)}`
    const emailDoc = buildPasswordResetEmail({
      shopName: shop.shopName,
      recipientName: tokenRes.recipientName,
      resetUrl,
      scope: "admin",
      expiresMinutes: 30,
    })
    const sendRes = await sendEmailWithGmailSmtp(
      {
        ...smtp,
        senderName: smtp.senderName || shop.shopName,
        replyTo: smtp.replyTo || shop.email || smtp.gmailUser,
      },
      {
        to: tokenRes.email,
        subject: emailDoc.subject,
        html: emailDoc.html,
        text: emailDoc.text,
      }
    )
    if (!sendRes.ok) {
      return fail("Could not send the reset email via Gmail SMTP. Please verify your Gmail App Password.")
    }
    return { ok: true }
  }

  // Fallback: Supabase Auth recovery email when Gmail SMTP is disabled
  cookieStore.set("kk_recovery_intent", "admin", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600,
    path: "/",
  })

  // Only send the admin recovery email if this address actually belongs to an admin account (fail closed on RPC error).
  const { data: isAdminEmail, error: isAdminErr } = await supabase.rpc("is_admin_email", {
    p_email: parsed.data.email,
    p_server_secret: getServerRpcSecret(),
  })
  if (isAdminErr || isAdminEmail !== true) {
    return { ok: true }
  }

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/auth/callback?flow=recovery&next=${encodeURIComponent("/admin/reset-password")}` : undefined,
  })
  return { ok: true }
}

/** Step 2 of "forgot password": sets the new admin password via one-time token (Gmail SMTP) or verified recovery session. */
export async function resetAdminPassword(
  input: unknown
): Promise<ActionResult<{ unlockedAt: number }>> {
  const parsed = adminResetWithTokenSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])

  // Gmail SMTP one-time token flow
  if (parsed.data.token) {
    const tokenHash = hashResetToken(parsed.data.token)
    if (await limited("password-reset", `consume-admin:${tokenHash.slice(0, 16)}`)) return fail(RATE_LIMIT_MESSAGE)
    const { data: consumeData, error: consumeErr } = await supabase.rpc("consume_password_reset_token", {
      p_token_hash: tokenHash,
      p_scope: "admin",
      p_new_password: parsed.data.next,
      p_server_secret: getServerRpcSecret(),
    })
    const res = (!consumeErr && consumeData ? consumeData : null) as AdminConsumeTokenRpc | null
    if (!res?.ok || !res.email) {
      if (res?.code === "same_password") {
        return fail("Use a new password, not your current one.", {
          next: ["Use a new password, not your current one"],
        })
      }
      if (res?.code === "not_admin") {
        return fail("Not authorised")
      }
      return fail("This reset link has expired. Please request a new one.")
    }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: res.email,
      password: parsed.data.next,
    })
    if (signInErr || !signInData.user) {
      return fail("Password updated, but automatic sign-in failed. Please sign in at /admin/login.")
    }

    // Best-effort security alert email via Gmail SMTP
    const smtp = resolveMailerPayload(res.mailer)
    if (smtp) {
      try {
        const [shop, origin] = await Promise.all([getStoreSettings(), trustedOrigin()])
        const loginUrl = `${origin ?? siteConfig.url}/admin/login`
        const confirmDoc = buildPasswordChangedEmail({
          shopName: shop.shopName,
          recipientName: res.recipientName,
          scope: "admin",
          loginUrl,
        })
        await sendEmailWithGmailSmtp(
          {
            ...smtp,
            senderName: smtp.senderName || shop.shopName,
            replyTo: smtp.replyTo || shop.email || smtp.gmailUser,
          },
          {
            to: res.email,
            subject: confirmDoc.subject,
            html: confirmDoc.html,
            text: confirmDoc.text,
          }
        )
      } catch {
        // Non-blocking
      }
    }

    cookieStore.delete("kk_pw_reset")
    cookieStore.delete("kk_recovery_intent")
    const now = Date.now()
    await stampAdminPinUnlock(signInData.user.id, now)
    revalidatePath("/admin", "layout")
    revalidatePath("/", "layout")
    return { ok: true, data: { unlockedAt: now } }
  }

  // Legacy Supabase Auth recovery cookie flow
  const [user, admin] = await Promise.all([getCurrentUser(), isAdminUser()])
  if (!user) return fail("This reset link has expired. Please request a new one.")
  if (!admin) return fail("Not authorised")
  if (!hasValidPasswordResetCookie(cookieStore.get("kk_pw_reset")?.value, "admin", user.id)) {
    return fail("This reset link has expired. Please request a new one.")
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("different") || msg.includes("same") || error.code === "same_password") {
      return fail("Use a new password, not your current one.", {
        next: ["Use a new password, not your current one"],
      })
    }
    return fail("Could not set the new password. Please request a new reset link.")
  }
  if (user.email) {
    await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.next })
  }
  await supabase.rpc("clear_admin_pin_lock")
  cookieStore.delete("kk_pw_reset")
  cookieStore.delete("kk_recovery_intent")
  const now = Date.now()
  await stampAdminPinUnlock(user.id, now)
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now } }
}

const PIN_COOKIE_NAME = "kk_admin_pin_at"
const PIN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60

async function stampAdminPinUnlock(userId: string, value: "locked" | number = Date.now()) {
  const cookieStore = await cookies()
  cookieStore.set(PIN_COOKIE_NAME, signAdminPinCookie(userId, value), {
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
  const { data: stateData } = await supabase.rpc("get_admin_pin_state")
  const state = (stateData ?? {}) as RpcPinState
  if (state.mode === "enabled" && state.hasPin) {
    return fail("A PIN is already set. Enter your current PIN or account password to change it.")
  }

  const { error } = await supabase.rpc("set_admin_pin", { p_pin: parsed.data.pin })
  if (error) return fail("Could not save your PIN. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(auth.user.id, now)
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

  const { error } = await supabase.rpc("set_admin_pin", {
    p_pin: parsed.data.next,
    p_current_pin: parsed.data.authMethod === "pin" ? (parsed.data.currentPin ?? null) : null,
  })
  if (error) return fail("Could not update your PIN. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(auth.user.id, now)
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

  let currentPinForRpc: string | null = null
  if (state.mode === "enabled" && state.hasPin) {
    const body = (input && typeof input === "object" ? input : {}) as {
      currentPin?: unknown
      password?: unknown
    }
    const pinCandidate = typeof body.currentPin === "string" ? body.currentPin.trim() : ""
    const pwCandidate = typeof body.password === "string" ? body.password : ""
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
      currentPinForRpc = pinCandidate
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

  const { error } = await supabase.rpc("disable_admin_pin", {
    p_current_pin: currentPinForRpc,
  })
  if (error) return fail("Could not turn off PIN lock. Please try again.")

  const now = Date.now()
  await stampAdminPinUnlock(auth.user.id, now)
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
  await stampAdminPinUnlock(auth.user.id, now)
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
  await stampAdminPinUnlock(auth.user.id, now)
  revalidatePath("/admin", "layout")
  return { ok: true, data: { unlockedAt: now, mode: nextMode } }
}

/** Immediately locks the admin panel with the 4-digit PIN screen ("Lock now"). */
export async function lockAdminScreen(): Promise<ActionResult> {
  const auth = await assertAdmin({ allowWhenPinLocked: true })
  if (!auth.ok) return fail(auth.error)
  const supabase = await getServerSupabase()
  const { data: stateData } = await supabase.rpc("get_admin_pin_state")
  const state = (stateData ?? {}) as RpcPinState
  if (state.mode !== "enabled" || !state.hasPin) {
    return fail("Set a 4-digit PIN first before locking the screen.")
  }
  await stampAdminPinUnlock(auth.user.id, "locked")
  revalidatePath("/admin", "layout")
  return { ok: true }
}

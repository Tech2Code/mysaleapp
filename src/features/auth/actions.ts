"use server"

import type { User } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { hasValidPasswordResetCookie, signAdminPinCookie } from "@/features/auth/guards"
import { generateResetToken, getServerRpcSecret, hashResetToken } from "@/features/email/crypto"
import { resolveMailerPayload, sendEmailWithGmailSmtp, type EncryptedMailerPayload } from "@/features/email/mailer"
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildSignupVerifyEmail,
  buildWelcomeEmail,
} from "@/features/email/templates"
import { getStoreSettings } from "@/features/settings/queries"
import { syncWishlistForUser } from "@/features/wishlist/actions"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { safeNextPath } from "@/lib/safe-redirect"
import { v } from "@/lib/validation"
import { cleanMetaName, isSupabaseConfigured, safeAvatarUrl } from "@/lib/supabase/config"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { getServerSupabase } from "@/lib/supabase/server"
import type { SessionUser } from "@/store/auth"

const loginSchema = z.object({
  email: v.email(),
  password: v.password(),
  wishlistIds: z.array(z.string()).max(200).optional(),
})

const customerSignUpSchema = z
  .object({
    fullName: v.personName("full name"),
    phone: v.phoneIN(),
    email: v.email(),
    password: v.newPassword(),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "Please accept the Terms of Service and Privacy Policy." }),
    next: z.string().optional(),
    wishlistIds: z.array(z.string()).max(200).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

function buildSessionUser(user: User, profileName?: string | null, profileAvatar?: string | null): SessionUser {
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? "",
    name:
      cleanMetaName(profileName) ||
      cleanMetaName(meta.full_name) ||
      cleanMetaName(meta.name) ||
      user.email?.split("@")[0] ||
      "You",
    avatarUrl: safeAvatarUrl(profileAvatar) ?? safeAvatarUrl(meta.avatar_url),
  }
}

async function customerOrigin(): Promise<string | undefined> {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url)) return siteConfig.url
  if (process.env.NEXT_PUBLIC_SITE_URL) return siteConfig.url
  if (process.env.NODE_ENV === "production") return undefined
  return (await headers()).get("origin") ?? undefined
}

/** Customer email/password sign-in. */
export async function signInCustomer(
  input: unknown
): Promise<ActionResult<{ user: SessionUser; wishlistIds: string[]; reactivated?: boolean }>> {
  if (!isSupabaseConfigured) return fail("Login is unavailable in demo mode. Connect Supabase first (see README).")

  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email and password.", z.flattenError(parsed.error).fieldErrors)

  if (await limited("login", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("email not confirmed")) {
      return fail("Please confirm your email address first using the link sent to your inbox.")
    }
    return fail("Incorrect email or password.")
  }

  const user = data.user
  const metaName = cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name)
  const metaPhone = typeof user.user_metadata?.phone === "string" ? normalizeIndianPhone(user.user_metadata.phone) : null
  const [{ data: existing }, { data: restored }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; phone: string | null; avatar_url: string | null }>(),
    supabase.rpc("reactivate_my_account"),
  ])
  const reactivated = Boolean(restored)

  const resolvedName = cleanMetaName(existing?.full_name) || metaName || null
  const resolvedPhone = existing?.phone || metaPhone || null

  if ((metaName && !existing?.full_name) || (metaPhone && !existing?.phone)) {
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: resolvedName,
      phone: resolvedPhone,
    })
  }

  const wishRes = await syncWishlistForUser(user.id, parsed.data.wishlistIds)
  const wishlistIds = wishRes.ok ? wishRes.data : (parsed.data.wishlistIds ?? [])

  const cookieStore = await cookies()
  cookieStore.delete("kk_cust_pw_reset")

  revalidatePath("/", "layout")

  return {
    ok: true,
    data: {
      user: buildSessionUser(user, resolvedName, existing?.avatar_url),
      wishlistIds,
      ...(reactivated ? { reactivated: true } : {}),
    },
  }
}

/** Customer sign-up with basic details (name, phone) and email/password. */
export async function signUpCustomer(
  input: unknown
): Promise<ActionResult<{ needsEmailConfirmation: boolean; user?: SessionUser; wishlistIds?: string[] }>> {
  if (!isSupabaseConfigured) return fail("Sign-up is unavailable in demo mode. Connect Supabase first (see README).")

  const parsed = customerSignUpSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  if (await limited("login", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const origin = await customerOrigin()
  const nextPath = safeNextPath(parsed.data.next ?? null, "/")
  const supabase = await getServerSupabase()

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        terms_accepted_at: new Date().toISOString(),
        terms_version: "2026-11",
      },
      ...(origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}` } : {}),
    },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("already") || msg.includes("registered")) {
      return fail("An account with this email already exists. Please sign in instead.")
    }
    if (msg.includes("rate limit") || error.code === "over_email_send_rate_limit") {
      return fail(
        "Email limit reached on Supabase's free mail sender (max ~3 emails/hour). Turn off 'Confirm email' in Supabase → Authentication → Providers → Email, or wait a bit and try again."
      )
    }
    if (msg.includes("signups not allowed") || msg.includes("signup_disabled")) {
      return fail("New sign-ups are disabled in Supabase. Enable 'Allow new users to sign up' in Supabase → Authentication → User Signups.")
    }
    if (msg.includes("invalid") && msg.includes("email")) {
      return fail("Please use a real email address (test domains like @example.com are blocked by Supabase).")
    }
    if (msg.includes("weak_password") || msg.includes("password")) {
      return fail("Please choose a stronger password (at least 8 characters).")
    }
    return fail("Could not create your account. Please try again.")
  }

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return fail("An account with this email already exists. Please sign in instead.")
  }

  if (data.user && data.session) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
    })
    const wishRes = await syncWishlistForUser(data.user.id, parsed.data.wishlistIds)
    const wishlistIds = wishRes.ok ? wishRes.data : (parsed.data.wishlistIds ?? [])

    // Best-effort Welcome email via Gmail SMTP when enabled in Admin → Settings
    try {
      const { data: mailData, error: mailErr } = await supabase.rpc("prepare_signup_email", {
        p_user_id: data.user.id,
        p_server_secret: getServerRpcSecret(),
        p_create_verify_token: false,
      })
      const mailRes = (!mailErr && mailData ? mailData : null) as {
        smtpEnabled?: boolean
        email?: string
        mailer?: EncryptedMailerPayload | null
      } | null
      const smtp = mailRes?.smtpEnabled ? resolveMailerPayload(mailRes.mailer) : null
      if (smtp && mailRes?.email) {
        const shop = await getStoreSettings()
        const welcomeDoc = buildWelcomeEmail({
          shopName: shop.shopName,
          recipientName: parsed.data.fullName,
          shopUrl: origin ?? siteConfig.url,
        })
        await sendEmailWithGmailSmtp(
          {
            ...smtp,
            senderName: smtp.senderName || shop.shopName,
            replyTo: smtp.replyTo || shop.email || smtp.gmailUser,
          },
          {
            to: mailRes.email,
            subject: welcomeDoc.subject,
            html: welcomeDoc.html,
            text: welcomeDoc.text,
          }
        )
      }
    } catch {
      // Non-blocking: account is already created and signed in.
    }

    revalidatePath("/", "layout")
    return {
      ok: true,
      data: {
        needsEmailConfirmation: false,
        user: buildSessionUser(data.user, parsed.data.fullName),
        wishlistIds,
      },
    }
  }

  // When email confirmation is required, also send a branded verification email via Gmail SMTP if enabled
  if (data.user) {
    try {
      const rawVerifyToken = generateResetToken()
      const { data: mailData, error: mailErr } = await supabase.rpc("prepare_signup_email", {
        p_user_id: data.user.id,
        p_server_secret: getServerRpcSecret(),
        p_create_verify_token: true,
        p_token_hash: hashResetToken(rawVerifyToken),
        p_ttl_minutes: 1440,
      })
      const mailRes = (!mailErr && mailData ? mailData : null) as {
        smtpEnabled?: boolean
        email?: string
        mailer?: EncryptedMailerPayload | null
      } | null
      const smtp = mailRes?.smtpEnabled ? resolveMailerPayload(mailRes.mailer) : null
      if (smtp && mailRes?.email) {
        const shop = await getStoreSettings()
        const baseUrl = origin ?? siteConfig.url
        const verifyUrl = `${baseUrl}/login?mode=verify-email&token=${encodeURIComponent(rawVerifyToken)}${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`
        const verifyDoc = buildSignupVerifyEmail({
          shopName: shop.shopName,
          recipientName: parsed.data.fullName,
          verifyUrl,
          expiresHours: 24,
        })
        await sendEmailWithGmailSmtp(
          {
            ...smtp,
            senderName: smtp.senderName || shop.shopName,
            replyTo: smtp.replyTo || shop.email || smtp.gmailUser,
          },
          {
            to: mailRes.email,
            subject: verifyDoc.subject,
            html: verifyDoc.html,
            text: verifyDoc.text,
          }
        )
      }
    } catch {
      // Non-blocking fallback to Supabase confirmation email.
    }
  }

  return { ok: true, data: { needsEmailConfirmation: true } }
}

/** Customer sign-out: clears the server session cookie and invalidates cached user pages via cookie mutation. */
export async function signOutCustomer(): Promise<ActionResult> {
  if (isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()
  }
  const cookieStore = await cookies()
  cookieStore.delete("kk_cust_pw_reset")
  cookieStore.delete("kk_acct_reactivated")
  cookieStore.delete("kk_recovery_intent")
  cookieStore.delete("kk_admin_pin_at")
  cookieStore.delete("kk_pw_reset")
  revalidatePath("/account", "layout")
  revalidatePath("/checkout")
  revalidatePath("/", "layout")
  return { ok: true }
}

const customerForgotSchema = z.object({
  email: v.email(),
  next: z.string().optional(),
})

const customerResetSchema = z
  .object({
    next: v.newPassword(),
    confirm: z.string(),
    token: z.string().trim().min(32).max(128).optional(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

type CreateResetTokenRpc = {
  smtpEnabled?: boolean
  found?: boolean
  email?: string
  recipientName?: string | null
  mailer?: EncryptedMailerPayload | null
}

type ConsumeResetTokenRpc = {
  ok?: boolean
  code?: string
  email?: string
  recipientName?: string | null
  reactivated?: boolean
  mailer?: EncryptedMailerPayload | null
}

/** Customer "Forgot password?": sends a one-time password recovery email link via Gmail SMTP (if enabled) or Supabase Auth. */
export async function requestCustomerPasswordReset(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Password reset is unavailable in demo mode. Connect Supabase first (see README).")
  const parsed = customerForgotSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)

  if (await limited("password-reset", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const [origin, cookieStore, supabase] = await Promise.all([
    customerOrigin(),
    cookies(),
    getServerSupabase(),
  ])
  const nextPath = safeNextPath(parsed.data.next ?? null, "/")
  const baseUrl = origin ?? siteConfig.url

  // Try Gmail SMTP token flow first (active when Admin → Settings → Gmail SMTP is enabled)
  const rawToken = generateResetToken()
  const tokenHash = hashResetToken(rawToken)
  const { data: rpcData, error: rpcErr } = await supabase.rpc("create_password_reset_token", {
    p_email: parsed.data.email,
    p_scope: "customer",
    p_token_hash: tokenHash,
    p_server_secret: getServerRpcSecret(),
    p_ttl_minutes: 30,
  })
  const tokenRes = (!rpcErr && rpcData ? rpcData : null) as CreateResetTokenRpc | null

  if (tokenRes?.smtpEnabled) {
    if (!tokenRes.found || !tokenRes.email) {
      // Never reveal whether an email is registered
      return { ok: true }
    }
    const smtp = resolveMailerPayload(tokenRes.mailer)
    if (!smtp) {
      return fail("Email service is misconfigured. Please contact support.")
    }
    const shop = await getStoreSettings()
    const resetUrl = `${baseUrl}/login?mode=reset-password&token=${encodeURIComponent(rawToken)}${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`
    const emailDoc = buildPasswordResetEmail({
      shopName: shop.shopName,
      recipientName: tokenRes.recipientName,
      resetUrl,
      scope: "customer",
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
      return fail("Could not send the password reset email right now. Please try again later.")
    }
    return { ok: true }
  }

  // Fallback: Supabase built-in recovery email when Gmail SMTP is disabled
  cookieStore.set("kk_recovery_intent", "customer", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 3600,
    path: "/",
  })
  const callbackUrl = origin
    ? `${origin}/auth/callback?flow=recovery${nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""}`
    : undefined
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl,
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("rate limit") || error.code === "over_email_send_rate_limit") {
      return fail(
        "Email limit reached on Supabase's free mail sender. Enable Gmail SMTP in Admin → Settings or try again in a few minutes."
      )
    }
  }
  return { ok: true }
}

/** Step 2 of customer "Forgot password?": sets the new password after clicking the emailed reset link. */
export async function resetCustomerPassword(
  input: unknown
): Promise<ActionResult<{ user: SessionUser; reactivated?: boolean }>> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")
  const parsed = customerResetSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])

  // Gmail SMTP one-time token flow
  if (parsed.data.token) {
    const tokenHash = hashResetToken(parsed.data.token)
    if (await limited("password-reset", `consume:${tokenHash.slice(0, 16)}`)) return fail(RATE_LIMIT_MESSAGE)
    const { data: consumeData, error: consumeErr } = await supabase.rpc("consume_password_reset_token", {
      p_token_hash: tokenHash,
      p_scope: "customer",
      p_new_password: parsed.data.next,
      p_server_secret: getServerRpcSecret(),
    })
    const res = (!consumeErr && consumeData ? consumeData : null) as ConsumeResetTokenRpc | null
    if (!res?.ok || !res.email) {
      if (res?.code === "same_password") {
        return fail("Use a new password, not your current one.", {
          next: ["Use a new password, not your current one"],
        })
      }
      return fail("This reset link has expired. Please request a new one.")
    }

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: res.email,
      password: parsed.data.next,
    })
    if (signInErr || !signInData.user) {
      return fail("Password updated, but automatic sign-in failed. Please sign in with your new password.")
    }

    const signedUser = signInData.user
    const { data: existing } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", signedUser.id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>()

    // Best-effort security confirmation email via Gmail SMTP
    const smtp = resolveMailerPayload(res.mailer)
    if (smtp) {
      try {
        const [shop, origin] = await Promise.all([getStoreSettings(), customerOrigin()])
        const loginUrl = `${origin ?? siteConfig.url}/login`
        const confirmDoc = buildPasswordChangedEmail({
          shopName: shop.shopName,
          recipientName: res.recipientName ?? existing?.full_name,
          scope: "customer",
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
        // Non-blocking: password is already updated and session established.
      }
    }

    cookieStore.delete("kk_cust_pw_reset")
    cookieStore.delete("kk_recovery_intent")
    cookieStore.delete("kk_acct_reactivated")
    revalidatePath("/account", "layout")
    revalidatePath("/", "layout")
    return {
      ok: true,
      data: {
        user: buildSessionUser(signedUser, existing?.full_name, existing?.avatar_url),
        ...(res.reactivated ? { reactivated: true } : {}),
      },
    }
  }

  // Legacy Supabase Auth recovery cookie flow
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return fail("This reset link has expired. Please request a new one.")

  if (!hasValidPasswordResetCookie(cookieStore.get("kk_cust_pw_reset")?.value, "customer", user.id)) {
    return fail("This reset link has expired. Please request a new one.")
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
    data: { has_password: true },
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("different") || msg.includes("same") || error.code === "same_password") {
      return fail("Use a new password, not your current one.", {
        next: ["Use a new password, not your current one"],
      })
    }
    return fail("Could not set the new password. Please request a new reset link.")
  }

  const [{ data: existing }, { data: restored }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; avatar_url: string | null }>(),
    supabase.rpc("reactivate_my_account"),
  ])
  const reactivated = Boolean(restored)

  cookieStore.delete("kk_cust_pw_reset")
  cookieStore.delete("kk_recovery_intent")
  cookieStore.delete("kk_acct_reactivated")
  revalidatePath("/account", "layout")
  revalidatePath("/", "layout")
  return {
    ok: true,
    data: {
      user: buildSessionUser(user, existing?.full_name, existing?.avatar_url),
      ...(reactivated ? { reactivated: true } : {}),
    },
  }
}

/** Email/password login for the shop owner. Non-admin accounts are rejected. */
export async function signInAdmin(input: unknown): Promise<ActionResult<{ user: SessionUser }>> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")

  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email and password.")

  // Decision: the limiter fails open on purpose (a limiter outage must not lock the owner out); Supabase Auth has its own brute-force limits.
  if (await limited("login", parsed.data.email)) return fail(RATE_LIMIT_MESSAGE)

  const supabase = await getServerSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })
  // Same message for wrong email or password — don't reveal which accounts exist.
  if (error || !data.user) return fail("Incorrect email or password.")

  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (isAdmin !== true) {
    await supabase.auth.signOut()
    // Return the exact same message as wrong credentials so we never reveal that a non-admin account exists.
    return fail("Incorrect email or password.")
  }

  const user = data.user
  const metaName = cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name)
  const metaPhone = typeof user.user_metadata?.phone === "string" ? normalizeIndianPhone(user.user_metadata.phone) : null
  const { data: existing } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; phone: string | null; avatar_url: string | null }>()

  const resolvedName = cleanMetaName(existing?.full_name) || metaName || null
  const resolvedPhone = existing?.phone || metaPhone || null

  if ((metaName && !existing?.full_name) || (metaPhone && !existing?.phone)) {
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: resolvedName,
      phone: resolvedPhone,
    })
  }

  const cookieStore = await cookies()
  cookieStore.delete("kk_pw_reset")
  cookieStore.set("kk_admin_pin_at", signAdminPinCookie(user.id, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  })

  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
  return { ok: true, data: { user: buildSessionUser(user, resolvedName, existing?.avatar_url) } }
}

export async function signOutAdmin(
  reason?: "session-expired"
): Promise<ActionResult<{ redirectTo: string }>> {
  if (isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()
  }
  const cookieStore = await cookies()
  cookieStore.delete("kk_admin_pin_at")
  cookieStore.delete("kk_pw_reset")
  cookieStore.delete("kk_recovery_intent")
  cookieStore.delete("kk_cust_pw_reset")
  cookieStore.delete("kk_acct_reactivated")
  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
  return {
    ok: true,
    data: {
      redirectTo:
        reason === "session-expired"
          ? "/admin/login?reason=session-expired"
          : "/admin/login",
    },
  }
}

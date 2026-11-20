"use server"

import type { User } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { hasValidPasswordResetCookie, signAdminPinCookie } from "@/features/auth/guards"
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
  })
  .refine((d) => d.next === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

/** Customer "Forgot password?": sends a one-time password recovery email link. */
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
        "Email limit reached on Supabase's free mail sender. Please wait a few minutes and try again."
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

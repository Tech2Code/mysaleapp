"use server"

import type { User } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { syncWishlistForUser } from "@/features/wishlist/actions"
import { fail, type ActionResult } from "@/lib/action-result"
import { safeNextPath } from "@/lib/safe-redirect"
import { v } from "@/lib/validation"
import { isSupabaseConfigured, safeAvatarUrl } from "@/lib/supabase/config"
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
      profileName?.trim() ||
      (meta.full_name as string | undefined)?.trim() ||
      (meta.name as string | undefined)?.trim() ||
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
): Promise<ActionResult<{ user: SessionUser; wishlistIds: string[] }>> {
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
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const metaPhone = (user.user_metadata?.phone as string | undefined)?.trim()
  const { data: existing } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; phone: string | null; avatar_url: string | null }>()

  const resolvedName = existing?.full_name || metaName || null
  const resolvedPhone = existing?.phone || metaPhone || null

  if ((metaName && !existing?.full_name) || (metaPhone && !existing?.phone)) {
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: resolvedName,
      phone: resolvedPhone,
    })
  } else if (
    (existing?.full_name && existing.full_name.trim() !== (metaName ?? "")) ||
    (existing?.phone && existing.phone.trim() !== (metaPhone ?? ""))
  ) {
    await supabase.auth.updateUser({
      data: {
        full_name: resolvedName,
        phone: resolvedPhone,
      },
    })
  }

  const wishRes = await syncWishlistForUser(user.id, parsed.data.wishlistIds)
  const wishlistIds = wishRes.ok ? wishRes.data : (parsed.data.wishlistIds ?? [])

  revalidatePath("/", "layout")

  return {
    ok: true,
    data: {
      user: buildSessionUser(user, resolvedName, existing?.avatar_url),
      wishlistIds,
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
      return fail(error.message)
    }
    return fail(`Could not create your account (${error.message}).`)
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

/** Customer sign-out: clears the server session cookie and invalidates cached user pages. */
export async function signOutCustomer(): Promise<ActionResult> {
  if (isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    await supabase.auth.signOut()
  }
  revalidatePath("/", "layout")
  return { ok: true }
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
    return fail("This account doesn't have admin access.")
  }

  const user = data.user
  const metaName = (user.user_metadata?.full_name as string | undefined)?.trim()
  const metaPhone = (user.user_metadata?.phone as string | undefined)?.trim()
  const { data: existing } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null; phone: string | null; avatar_url: string | null }>()

  const resolvedName = existing?.full_name || metaName || null
  const resolvedPhone = existing?.phone || metaPhone || null

  if ((metaName && !existing?.full_name) || (metaPhone && !existing?.phone)) {
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: resolvedName,
      phone: resolvedPhone,
    })
  } else if (
    (existing?.full_name && existing.full_name.trim() !== (metaName ?? "")) ||
    (existing?.phone && existing.phone.trim() !== (metaPhone ?? ""))
  ) {
    await supabase.auth.updateUser({
      data: {
        full_name: resolvedName,
        phone: resolvedPhone,
      },
    })
  }

  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
  return { ok: true, data: { user: buildSessionUser(user, resolvedName, existing?.avatar_url) } }
}

export async function signOutAdmin(reason?: "session-expired"): Promise<void> {
  const supabase = await getServerSupabase()
  await supabase.auth.signOut()
  revalidatePath("/admin", "layout")
  revalidatePath("/", "layout")
  redirect(reason === "session-expired" ? "/admin/login?reason=session-expired" : "/admin/login")
}

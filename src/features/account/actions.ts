"use server"

// Customer account: the signed-in shopper's own profile (name, email, phone). Admin login/password lives in features/auth/account-*.

import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { getCurrentUser } from "@/features/auth/guards"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { cleanMetaName, safeAvatarUrl } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { customerPasswordSchema, deactivateAccountSchema, profileSchema, type Profile } from "./schema"

async function trustedOrigin(): Promise<string | undefined> {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url)) return siteConfig.url
  if (process.env.NEXT_PUBLIC_SITE_URL) return siteConfig.url
  if (process.env.NODE_ENV === "production") return undefined
  return (await headers()).get("origin") ?? undefined
}

type ProfileRow = {
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  deactivated_at?: string | null
}

/** Name, phone and email of the signed-in customer. Returns null for guests. */
export async function getMyProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url, deactivated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()

  let reactivated = false
  if (data?.deactivated_at) {
    const { data: restored } = await supabase.rpc("reactivate_my_account")
    reactivated = Boolean(restored)
  }

  const inRecovery = cookieStore.get("kk_cust_pw_reset")?.value === "1"
  const providers = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : []
  const hasEmailProvider =
    Boolean(user.user_metadata?.has_password) ||
    providers.includes("email") ||
    Boolean(user.identities?.some((i) => i.provider === "email"))

  const metaPhone = typeof user.user_metadata?.phone === "string" ? normalizeIndianPhone(user.user_metadata.phone) : null
  return {
    fullName: cleanMetaName(data?.full_name) ?? cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name) ?? "",
    phone: data?.phone ?? metaPhone ?? "",
    avatarUrl: safeAvatarUrl(data?.avatar_url),
    email: user.email ?? "",
    hasPassword: inRecovery ? false : hasEmailProvider,
    ...(reactivated ? { reactivated: true } : {}),
  }
}

export async function updateProfile(
  input: unknown
): Promise<ActionResult<{ email: string; emailConfirmationSentTo: string | null }>> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const p = parsed.data
  const normalizedPhone = p.phone ? normalizeIndianPhone(p.phone) : null
  const currentEmail = (user.email ?? "").trim()
  const requestedEmail = p.email?.trim().toLowerCase()
  const isEmailChanged = Boolean(requestedEmail && requestedEmail !== currentEmail.toLowerCase())
  if (isEmailChanged && (await limited("password-reset", user.id))) {
    return fail(RATE_LIMIT_MESSAGE)
  }

  const supabase = await getServerSupabase()
  const origin = isEmailChanged ? await trustedOrigin() : undefined

  // Request email change before mutating profiles so a rejected email doesn't leave partial profile edits saved.
  const authRes =
    isEmailChanged && requestedEmail
      ? await supabase.auth.updateUser(
          { email: requestedEmail },
          origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account/profile?email_changed=1")}` } : undefined
        )
      : { data: { user }, error: null }

  if (authRes.error && isEmailChanged) {
    const msg = authRes.error.message.toLowerCase()
    const code = authRes.error.code ?? ""
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
    return fail("Could not change your email address. Please try again.")
  }

  const profileRes = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: p.fullName,
    phone: normalizedPhone,
  })
  if (profileRes.error) return fail("Could not save your profile")

  const updatedEmail = authRes.data.user?.email?.trim() || currentEmail
  const emailAppliedImmediately =
    isEmailChanged && Boolean(requestedEmail) && updatedEmail.toLowerCase() === requestedEmail

  revalidatePath("/account", "layout")
  revalidatePath("/checkout")
  revalidatePath("/", "layout")
  return {
    ok: true,
    data: {
      email: emailAppliedImmediately && requestedEmail ? requestedEmail : currentEmail,
      emailConfirmationSentTo: isEmailChanged && !emailAppliedImmediately && requestedEmail ? requestedEmail : null,
    },
  }
}

/** Updates (or sets for the first time on Google-only accounts) the customer's login password. */
export async function changeCustomerPassword(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")
  if (!user.email) return fail("This account has no email address to set a password for.")

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const inRecovery = cookieStore.get("kk_cust_pw_reset")?.value === "1"
  const providers = Array.isArray(user.app_metadata?.providers) ? (user.app_metadata.providers as string[]) : []
  const hasExistingPassword =
    !inRecovery &&
    (Boolean(user.user_metadata?.has_password) ||
      providers.includes("email") ||
      Boolean(user.identities?.some((i) => i.provider === "email")))

  const parsed = customerPasswordSchema.safeParse({
    ...(input && typeof input === "object" ? input : {}),
    hasPassword: hasExistingPassword,
  })
  if (!parsed.success) {
    return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  if (await limited("login", user.email)) return fail(RATE_LIMIT_MESSAGE)

  if (hasExistingPassword) {
    const check = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.current ?? "",
    })
    if (check.error) {
      return fail("Your current password is incorrect.", {
        current: ["Incorrect password"],
      })
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.next,
    data: { has_password: true },
  })
  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("different") || msg.includes("same")) {
      return fail("Use a new password, not your current one.", {
        next: ["Use a new password, not your current one"],
      })
    }
    return fail("Could not update your password. Please try again.")
  }

  cookieStore.delete("kk_cust_pw_reset")
  revalidatePath("/account/profile")
  return { ok: true }
}

/**
 * Deactivates the signed-in customer's account and signs them out.
 * Blocked if the customer has active unfulfilled orders or open return requests.
 * Signing back in later automatically restores the account.
 */
export async function deactivateMyAccount(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = deactivateAccountSchema.safeParse(input ?? {})
  if (!parsed.success) {
    return fail("Please check your reason.", z.flattenError(parsed.error).fieldErrors)
  }

  if (await limited("login", user.id)) return fail(RATE_LIMIT_MESSAGE)

  const [cookieStore, supabase] = await Promise.all([cookies(), getServerSupabase()])
  const { error } = await supabase.rpc("deactivate_my_account", {
    p_reason: parsed.data.reason ?? null,
  })

  if (error) {
    const msg = error.message
    if (msg.includes("ADMIN_CANNOT_DEACTIVATE")) {
      return fail("Store owner / admin accounts cannot be deactivated here.")
    }
    if (msg.includes("ACTIVE_ORDERS_EXIST")) {
      return fail("You have active orders in progress. Please wait until your active orders are delivered or cancelled before deactivating your account.")
    }
    if (msg.includes("OPEN_RETURNS_EXIST")) {
      return fail("You have an open return or exchange request in progress. Please wait until it is completed before deactivating your account.")
    }
    return fail("Could not deactivate your account. Please try again.")
  }

  await supabase.auth.signOut()
  cookieStore.delete("kk_cust_pw_reset")
  revalidatePath("/", "layout")
  revalidatePath("/account", "layout")
  return { ok: true }
}

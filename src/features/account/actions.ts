"use server"

// Customer account: the signed-in shopper's own profile (name, email, phone). Admin login/password lives in features/auth/account-*.

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { z } from "zod"
import { siteConfig } from "@/config/site"
import { getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { safeAvatarUrl } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { profileSchema, type Profile } from "./schema"

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
}

/** Name, phone and email of the signed-in customer. Returns null for guests. */
export async function getMyProfile(): Promise<Profile | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>()

  return {
    fullName: data?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "",
    phone: data?.phone ?? (user.user_metadata?.phone as string | undefined) ?? "",
    avatarUrl: safeAvatarUrl(data?.avatar_url),
    email: user.email ?? "",
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

  const supabase = await getServerSupabase()
  const origin = isEmailChanged ? await trustedOrigin() : undefined

  const [profileRes, authRes] = await Promise.all([
    supabase.from("profiles").upsert({
      id: user.id,
      full_name: p.fullName,
      phone: normalizedPhone,
    }),
    supabase.auth.updateUser(
      {
        ...(isEmailChanged && requestedEmail ? { email: requestedEmail } : {}),
        data: {
          full_name: p.fullName,
          phone: normalizedPhone,
        },
      },
      isEmailChanged && origin ? { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account/profile?email_changed=1")}` } : undefined
    ),
  ])

  if (profileRes.error) return fail("Could not save your profile")
  if (authRes.error && isEmailChanged) {
    const msg = authRes.error.message.toLowerCase()
    if (msg.includes("already") || msg.includes("registered")) {
      return fail("That email is already used by another account.", {
        email: ["That email is already used by another account."],
      })
    }
    if (msg.includes("rate limit") || authRes.error.code === "over_email_send_rate_limit") {
      return fail("Too many email requests right now. Please wait a bit before changing your email again.")
    }
    return fail("Could not change your email address. Please try again.")
  }

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

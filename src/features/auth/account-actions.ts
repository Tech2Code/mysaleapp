"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { z } from "zod"
import { assertAdmin, getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { changePasswordSchema, emailSchema, profileSchema, resetSchema } from "./account-schema"

/**
 * Admin account management: profile, email, password, and the "forgot password" flow.
 * Emails (confirmation / reset link) are sent by Supabase Auth; see README → "Admin account emails".
 */

export async function updateAdminProfile(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.updateUser({ data: { full_name: parsed.data.name, phone: parsed.data.phone ?? null } })
  if (error) return fail("Could not save your details. Please try again.")
  return { ok: true }
}

/** Supabase emails a confirmation link to the NEW address; the login email changes once it is clicked. */
export async function requestAdminEmailChange(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)
  if (parsed.data.email.toLowerCase() === auth.user.email?.toLowerCase()) return fail("That is already your email address.")

  const supabase = await getServerSupabase()
  const origin = (await headers()).get("origin") ?? undefined
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    origin ? { emailRedirectTo: `${origin}/auth/callback?next=/admin/account` } : undefined
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

  const supabase = await getServerSupabase()
  const check = await supabase.auth.signInWithPassword({ email: auth.user.email, password: parsed.data.current })
  if (check.error) return fail("Your current password is incorrect.", { current: ["Incorrect password"] })

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) return fail("Could not change the password. Please try again.")
  return { ok: true }
}

/** Public: sends a reset link. Always answers the same, so it can't be used to find out which emails are admins. */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")
  const parsed = emailSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email address.", z.flattenError(parsed.error).fieldErrors)

  const origin = (await headers()).get("origin")
  const supabase = await getServerSupabase()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/auth/callback?next=/admin/reset-password` : undefined,
  })
  return { ok: true }
}

/** Step 2 of "forgot password": the reset link signed the person in; they now choose a new password. */
export async function resetAdminPassword(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("This reset link has expired. Please request a new one.")
  const parsed = resetSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", z.flattenError(parsed.error).fieldErrors)

  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next })
  if (error) return fail("Could not set the new password. Please request a new reset link.")
  redirect("/admin")
}

"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { fail, type ActionResult } from "@/lib/action-result"
import { v } from "@/lib/validation"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

const loginSchema = z.object({
  email: v.email(),
  password: v.password(),
})

/** Email/password login for the shop owner. Non-admin accounts are rejected. */
export async function signInAdmin(input: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return fail("Connect Supabase first (see README).")

  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return fail("Enter a valid email and password.")

  const supabase = await getServerSupabase()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  // Same message for wrong email or password — don't reveal which accounts exist.
  if (error) return fail("Incorrect email or password.")

  const { data: isAdmin } = await supabase.rpc("is_admin")
  if (isAdmin !== true) {
    await supabase.auth.signOut()
    return fail("This account doesn't have admin access.")
  }

  return { ok: true }
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await getServerSupabase()
  await supabase.auth.signOut()
  redirect("/admin/login")
}

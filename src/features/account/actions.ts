"use server"

// Customer account: the signed-in shopper's own profile (name, phone). Admin login/password lives in features/auth/account-*.

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { normalizeIndianPhone } from "@/lib/format"
import { getServerSupabase } from "@/lib/supabase/server"
import { profileSchema, type Profile } from "./schema"

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
    phone: data?.phone ?? "",
    avatarUrl: data?.avatar_url ?? null,
    email: user.email ?? "",
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const user = await getCurrentUser()
  if (!user) return fail("Not signed in")

  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }

  const p = parsed.data
  const supabase = await getServerSupabase()
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: p.fullName,
    phone: p.phone ? normalizeIndianPhone(p.phone) : null,
  })
  if (error) return fail("Could not save your profile")

  revalidatePath("/account", "layout")
  return { ok: true }
}

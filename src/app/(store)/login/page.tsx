import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { LoginView } from "@/components/store/page-views"
import { getCurrentUser, hasValidPasswordResetCookie } from "@/features/auth/guards"
import { getServerRpcSecret, hashResetToken } from "@/features/email/crypto"
import { getStoreSettings } from "@/features/settings/queries"
import { safeNextPath } from "@/lib/safe-redirect"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; token?: string }>
}) {
  const [user, cookieStore, params] = await Promise.all([
    getCurrentUser(),
    cookies(),
    searchParams,
  ])
  const rawToken = params.token?.trim() || null
  let validResetToken: string | null = null

  if (params.mode === "verify-email" && rawToken && isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.rpc("consume_signup_verify_token", {
      p_token_hash: hashResetToken(rawToken),
      p_server_secret: getServerRpcSecret(),
    })
    const res = (!error && data ? data : null) as { ok?: boolean } | null
    const nextPath = safeNextPath(params.next ?? null, "/")
    const nextQs = nextPath !== "/" ? `&next=${encodeURIComponent(nextPath)}` : ""
    if (res?.ok) {
      redirect(`/login?verified=1${nextQs}`)
    }
    redirect(`/login?error=verify-expired${nextQs}`)
  }

  if (params.mode === "reset-password" && rawToken && isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.rpc("verify_password_reset_token", {
      p_token_hash: hashResetToken(rawToken),
      p_scope: "customer",
      p_server_secret: getServerRpcSecret(),
    })
    const res = (!error && data ? data : null) as { valid?: boolean } | null
    if (res?.valid) {
      validResetToken = rawToken
    } else {
      redirect("/login?mode=forgot&error=expired")
    }
  }

  const hasValidResetCookie = Boolean(
    user &&
      hasValidPasswordResetCookie(
        cookieStore.get("kk_cust_pw_reset")?.value,
        "customer",
        user.id
      )
  )
  if (params.mode === "reset-password" && !validResetToken && !hasValidResetCookie) {
    redirect("/login?mode=forgot&error=expired")
  }
  if (user && hasValidResetCookie && params.mode !== "reset-password") {
    redirect("/login?mode=reset-password")
  }
  if (user && params.mode !== "reset-password") {
    redirect(safeNextPath(params.next, "/"))
  }

  return <LoginView shop={await getStoreSettings()} resetToken={validResetToken} />
}

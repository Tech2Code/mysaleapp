import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { siteConfig } from "@/config/site"
import { safeNextPath } from "@/lib/safe-redirect"
import { getServerSupabase } from "@/lib/supabase/server"

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value as EmailOtpType)
}

/** Google OAuth and emailed admin links (password reset, email change) land here to establish a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const base = process.env.NEXT_PUBLIC_SITE_URL ? siteConfig.url : origin
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const otpType = searchParams.get("type")
  // Google/Supabase send these when the person pressed Cancel or something failed
  const oauthError = searchParams.get("error")
  const next = safeNextPath(searchParams.get("next"), "/account/orders")
  const isAdminNext = next === "/admin" || next.startsWith("/admin/")

  const finishSuccess = (target: string, isRecovery: boolean) => {
    const response = NextResponse.redirect(new URL(target, base))
    if (isRecovery) {
      response.cookies.set("kk_pw_reset", "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 900,
        path: "/",
      })
    }
    return response
  }

  if (code) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return finishSuccess(next, next === "/admin/reset-password" || otpType === "recovery")
  } else if (tokenHash && isOtpType(otpType)) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (!error) return finishSuccess(next, next === "/admin/reset-password" || otpType === "recovery")
  }

  // Step 1 of Supabase's two-step email change redirects with `?message=...` and neither `code` nor `error`.
  if (!code && !tokenHash && !oauthError && next === "/admin/account") {
    return NextResponse.redirect(new URL("/admin/account", base))
  }

  // An expired/used admin link (password reset, email confirmation) stays on the admin screens.
  if (isAdminNext) {
    if (next === "/admin/reset-password" || next === "/admin/account") {
      return NextResponse.redirect(new URL("/admin/forgot-password?error=expired", base))
    }
    return NextResponse.redirect(new URL("/admin/login", base))
  }

  if (oauthError) {
    const reason = oauthError === "access_denied" ? "cancelled" : "auth"
    return NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, base))
  }
  return NextResponse.redirect(new URL("/login?error=auth", base))
}

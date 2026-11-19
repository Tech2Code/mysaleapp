import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { siteConfig } from "@/config/site"
import { normalizeIndianPhone } from "@/lib/format"
import { safeNextPath } from "@/lib/safe-redirect"
import { cleanMetaName } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value as EmailOtpType)
}

/** Google OAuth and emailed admin links (password reset, email change) land here to establish a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const hasPublicSiteUrl = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url) || Boolean(process.env.NEXT_PUBLIC_SITE_URL)
  const base = hasPublicSiteUrl ? siteConfig.url : origin
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const otpType = searchParams.get("type")
  const infoMessage = searchParams.get("message")
  // Google/Supabase send these when the person pressed Cancel or something failed
  const oauthError = searchParams.get("error")
  const next = safeNextPath(searchParams.get("next"), "/")
  const nextPathname = next.split("?")[0]
  const isAdminNext = nextPathname === "/admin" || nextPathname.startsWith("/admin/")

  const finishSuccess = (target: string, isRecovery: boolean) => {
    const targetUrl = new URL(target, base)
    if (otpType === "email_change" && (targetUrl.pathname === "/admin/account" || targetUrl.pathname === "/account/profile")) {
      targetUrl.searchParams.set("email_changed", "1")
    }
    const response = NextResponse.redirect(targetUrl)
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

  const syncProfileFromMetadata = async (supabase: Awaited<ReturnType<typeof getServerSupabase>>) => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const metaName = cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name) ?? null
    const rawMetaPhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null
    const metaPhone = rawMetaPhone ? normalizeIndianPhone(rawMetaPhone) : null
    if (!metaName && !metaPhone) return
    const { data: existing } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; phone: string | null }>()
    if ((!existing?.full_name && metaName) || (!existing?.phone && metaPhone)) {
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: cleanMetaName(existing?.full_name) || metaName,
        phone: existing?.phone || metaPhone,
      })
    }
  }

  if (code) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await syncProfileFromMetadata(supabase)
      return finishSuccess(next, nextPathname === "/admin/reset-password" || otpType === "recovery")
    }
  } else if (tokenHash && isOtpType(otpType)) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (!error) {
      await syncProfileFromMetadata(supabase)
      return finishSuccess(next, nextPathname === "/admin/reset-password" || otpType === "recovery")
    }
  }

  // Step 1 of Supabase's two-step email change redirects with `?message=...` (or `#message=...`) and neither `code` nor `error`.
  if (!code && !tokenHash && !oauthError && (nextPathname === "/admin/account" || nextPathname === "/account/profile")) {
    const accountUrl = new URL(nextPathname, base)
    if (infoMessage) accountUrl.searchParams.set("message", infoMessage)
    return NextResponse.redirect(accountUrl)
  }

  // An expired/used admin link (password reset, email confirmation) stays on the admin screens.
  if (isAdminNext) {
    if (nextPathname === "/admin/reset-password" || nextPathname === "/admin/account") {
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

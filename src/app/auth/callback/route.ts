import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { siteConfig } from "@/config/site"
import { signPasswordResetCookie } from "@/features/auth/guards"
import { normalizeIndianPhone } from "@/lib/format"
import { safeNextPath } from "@/lib/safe-redirect"
import { cleanMetaName } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"])

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && OTP_TYPES.has(value as EmailOtpType)
}

/** Google OAuth and emailed links (password reset, signup confirmation, email change) land here to establish a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const hasPublicSiteUrl = !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteConfig.url) || Boolean(process.env.NEXT_PUBLIC_SITE_URL)
  const base = hasPublicSiteUrl ? siteConfig.url : origin
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const otpType = searchParams.get("type")
  const flow = searchParams.get("flow")
  const infoMessage = searchParams.get("message")
  // Google/Supabase send these when the person pressed Cancel or an email OTP link expired
  const oauthError = searchParams.get("error")
  const errorCode = searchParams.get("error_code")
  const errorDescription = (searchParams.get("error_description") ?? "").toLowerCase()
  const recoveryIntent = request.cookies.get("kk_recovery_intent")?.value
  const next = safeNextPath(searchParams.get("next"), "/")
  const nextPathname = next.split("?")[0]
  const isAdminNext = nextPathname === "/admin" || nextPathname.startsWith("/admin/")
  const isCustomerRecovery =
    !isAdminNext &&
    (next.includes("mode=reset-password") || otpType === "recovery" || recoveryIntent === "customer")

  const clearIntentAndRedirect = (url: URL) => {
    const res = NextResponse.redirect(url)
    res.cookies.delete("kk_recovery_intent")
    return res
  }

  const finishSuccess = (
    target: string,
    mode: "admin-recovery" | "customer-recovery" | "normal",
    userId?: string
  ) => {
    const targetUrl = new URL(target, base)
    if (otpType === "email_change" && (targetUrl.pathname === "/admin/account" || targetUrl.pathname === "/account/profile")) {
      targetUrl.searchParams.set("email_changed", "1")
    }
    if (mode === "admin-recovery") {
      targetUrl.pathname = "/admin/reset-password"
      targetUrl.search = ""
    } else if (mode === "customer-recovery" && targetUrl.pathname !== "/login") {
      const preservedNext = safeNextPath(`${targetUrl.pathname}${targetUrl.search}`, "/")
      targetUrl.pathname = "/login"
      targetUrl.search = ""
      targetUrl.searchParams.set("mode", "reset-password")
      if (preservedNext !== "/") {
        targetUrl.searchParams.set("next", preservedNext)
      }
    }
    const response = NextResponse.redirect(targetUrl)
    response.cookies.delete("kk_recovery_intent")
    if (mode === "admin-recovery" && userId) {
      response.cookies.set("kk_pw_reset", signPasswordResetCookie("admin", userId), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 900,
        path: "/",
      })
    }
    if (mode === "customer-recovery" && userId) {
      response.cookies.set("kk_cust_pw_reset", signPasswordResetCookie("customer", userId), {
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
    if (!user) return null
    const metaName = cleanMetaName(user.user_metadata?.full_name) ?? cleanMetaName(user.user_metadata?.name) ?? null
    const rawMetaPhone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null
    const metaPhone = rawMetaPhone ? normalizeIndianPhone(rawMetaPhone) : null
    if (metaName || metaPhone) {
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
    return user
  }

  const handleAuthenticatedSuccess = async (supabase: Awaited<ReturnType<typeof getServerSupabase>>) => {
    const user = await syncProfileFromMetadata(supabase)
    const isNonRecoveryOtp =
      otpType === "signup" ||
      otpType === "email_change" ||
      otpType === "invite" ||
      next.includes("email_changed=1")
    const recoverySentMs = user?.recovery_sent_at ? Date.parse(user.recovery_sent_at) : NaN
    const isRecentRecovery =
      flow !== "oauth" &&
      !isNonRecoveryOtp &&
      (flow === "recovery" || recoveryIntent === "admin" || recoveryIntent === "customer") &&
      !Number.isNaN(recoverySentMs) &&
      Date.now() - recoverySentMs < 60 * 60 * 1000

    const isRecoveryFlow =
      !isNonRecoveryOtp &&
      flow !== "oauth" &&
      (otpType === "recovery" ||
        flow === "recovery" ||
        nextPathname === "/admin/reset-password" ||
        next.includes("mode=reset-password") ||
        recoveryIntent === "admin" ||
        recoveryIntent === "customer" ||
        isRecentRecovery)

    if (isRecoveryFlow) {
      const { data: isAdmin } = await supabase.rpc("is_admin")
      const wantsAdminReset =
        isAdminNext ||
        recoveryIntent === "admin" ||
        (isAdmin === true && recoveryIntent !== "customer" && !next.includes("mode=reset-password"))

      if (wantsAdminReset) {
        if (isAdmin !== true || !user) {
          await supabase.auth.signOut()
          return clearIntentAndRedirect(new URL("/admin/login", base))
        }
        return finishSuccess("/admin/reset-password", "admin-recovery", user.id)
      }
      if (!user) {
        return clearIntentAndRedirect(new URL("/login?mode=forgot&error=expired", base))
      }
      return finishSuccess(next, "customer-recovery", user.id)
    }

    const response = finishSuccess(next, "normal", user?.id)
    if (!isAdminNext && user) {
      const { data: restored } = await supabase.rpc("reactivate_my_account")
      if (restored) {
        response.cookies.set("kk_acct_reactivated", "1", {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60,
          path: "/",
        })
      }
    }
    return response
  }

  if (code) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return handleAuthenticatedSuccess(supabase)
    }
  } else if (tokenHash && isOtpType(otpType)) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType })
    if (!error) {
      return handleAuthenticatedSuccess(supabase)
    }
  }

  // Step 1 of Supabase's two-step email change redirects with `?message=...` (or `#message=...`) and neither `code` nor `error`.
  if (!code && !tokenHash && !oauthError && (nextPathname === "/admin/account" || nextPathname === "/account/profile")) {
    const accountUrl = new URL(nextPathname, base)
    if (infoMessage && /confirmation link|other email|confirm/i.test(infoMessage)) {
      accountUrl.searchParams.set("message", "email_step_1")
    }
    return clearIntentAndRedirect(accountUrl)
  }

  const isExpiredLink =
    errorCode === "otp_expired" ||
    errorDescription.includes("expired") ||
    errorDescription.includes("invalid") ||
    Boolean(code) ||
    Boolean(tokenHash)

  // Email-change confirmation links return to the profile page where EmailForm / ProfileFormInner shows the banner.
  if (nextPathname === "/admin/account" || nextPathname === "/account/profile") {
    const errUrl = new URL(nextPathname, base)
    errUrl.searchParams.set("error_description", errorDescription || "expired")
    return clearIntentAndRedirect(errUrl)
  }

  // An expired/used admin link (password reset, email confirmation) stays on the admin screens.
  if (isAdminNext || recoveryIntent === "admin") {
    if (isExpiredLink || nextPathname === "/admin/reset-password") {
      return clearIntentAndRedirect(new URL("/admin/forgot-password?error=expired", base))
    }
    return clearIntentAndRedirect(new URL("/admin/login", base))
  }

  if (isCustomerRecovery || isExpiredLink) {
    return clearIntentAndRedirect(new URL("/login?mode=forgot&error=expired", base))
  }

  if (oauthError) {
    const reason = oauthError === "access_denied" ? "cancelled" : "auth"
    return clearIntentAndRedirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, base))
  }
  return clearIntentAndRedirect(new URL("/login?error=auth", base))
}

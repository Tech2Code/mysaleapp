import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { ADMIN_SESSION_MAX_AGE_MS } from "@/features/auth/account-schema"
import { isSupabaseConfigured, supabaseConfig } from "./config"

const PROD_FALLBACK_SECRET =
  process.env.NODE_ENV === "production" && !process.env.COOKIE_SECRET && !process.env.RATE_LIMIT_SALT && !process.env.CRON_SECRET
    ? (() => {
        console.warn("[proxy] Set COOKIE_SECRET or RATE_LIMIT_SALT in production.")
        return randomBytes(32).toString("hex")
      })()
    : "kalakriti-local-dev-cookie-secret"

function getCookieSecret(): string {
  return process.env.COOKIE_SECRET || process.env.RATE_LIMIT_SALT || process.env.CRON_SECRET || PROD_FALLBACK_SECRET
}

function hmacHex(payload: string): string {
  return createHmac("sha256", getCookieSecret()).update(payload).digest("hex").slice(0, 32)
}

function safeSigEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"))
  } catch {
    return false
  }
}

export function signPasswordResetCookie(scope: "admin" | "customer", userId: string, nowMs = Date.now()): string {
  const ts = String(Math.floor(nowMs))
  const sig = hmacHex(`pw-reset:${scope}:${userId}:${ts}`)
  return `${ts}.${sig}`
}

export function hasValidPasswordResetCookie(
  cookieVal: string | undefined,
  scope: "admin" | "customer",
  userId: string,
  maxAgeMs = 15 * 60 * 1000
): boolean {
  if (!cookieVal || !userId) return false
  const parts = cookieVal.split(".")
  if (parts.length !== 2) return false
  const [tsStr, sig] = parts
  const ts = Number(tsStr)
  if (!Number.isFinite(ts) || ts <= 0) return false
  const age = Date.now() - ts
  if (age < -60_000 || age > maxAgeMs) return false
  const expected = hmacHex(`pw-reset:${scope}:${userId}:${tsStr}`)
  return safeSigEqual(sig, expected)
}

export function signAdminPinCookie(userId: string, value: "locked" | number | string): string {
  const raw = value === "locked" ? "locked" : String(Math.floor(Number(value)))
  const sig = hmacHex(`admin-pin:${userId}:${raw}`)
  return `${raw}.${sig}`
}

export function parseAdminPinCookie(
  cookieVal: string | undefined,
  userId: string,
  pinUpdatedAt?: string | null
): { valid: boolean; manualLock: boolean; unlockedAt: number } {
  if (!cookieVal || !userId) return { valid: false, manualLock: false, unlockedAt: 0 }
  const parts = cookieVal.split(".")
  if (parts.length !== 2) return { valid: false, manualLock: false, unlockedAt: 0 }
  const [raw, sig] = parts
  const expected = hmacHex(`admin-pin:${userId}:${raw}`)
  if (!safeSigEqual(sig, expected)) return { valid: false, manualLock: false, unlockedAt: 0 }
  if (raw === "locked") return { valid: true, manualLock: true, unlockedAt: 0 }
  const ts = Number(raw)
  if (!Number.isFinite(ts) || ts <= 0 || ts > Date.now() + 60_000) {
    return { valid: false, manualLock: false, unlockedAt: 0 }
  }
  const updatedMs = pinUpdatedAt ? Date.parse(pinUpdatedAt) : NaN
  if (!Number.isNaN(updatedMs) && ts + 5_000 < updatedMs) {
    return { valid: false, manualLock: false, unlockedAt: 0 }
  }
  return { valid: true, manualLock: false, unlockedAt: ts }
}

/**
 * Refreshes the Supabase auth cookie on every matched request so Server
 * Components always see a valid session. Also does a cheap, optimistic
 * redirect for protected areas — the real authorization check lives in
 * features/auth/guards.ts and in database RLS.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl

  // If Supabase falls back to the Site URL root (e.g. /?code=... or /?error=access_denied&error_code=otp_expired),
  // forward immediately to /auth/callback so the user lands on the proper UI with a clean URL.
  // Never intercept /order-placed?code=... or /track?code=... where `code` is an order code!
  const hasSessionOrAction =
    request.cookies.getAll().some((c) => c.name.startsWith("sb-")) || request.headers.has("next-action")
  if (pathname === "/" && request.method === "GET") {
    const hasAuthCallbackParams =
      searchParams.has("code") ||
      searchParams.has("token_hash") ||
      searchParams.has("error_code") ||
      (searchParams.has("error") && searchParams.has("error_description"))
    if (hasAuthCallbackParams) {
      const callbackUrl = request.nextUrl.clone()
      callbackUrl.pathname = "/auth/callback"
      return NextResponse.redirect(callbackUrl)
    }
    if (!hasSessionOrAction) return NextResponse.next({ request })
  } else if (pathname === "/" && !hasSessionOrAction) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  if (!isSupabaseConfigured) return response

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Do not put code between createServerClient and getUser(): it refreshes the token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Never redirect POST / Server Action requests from proxy: returning a 307 redirect
  // to a Next-Action fetch causes Next.js's action response parser to throw
  // "An unexpected response was received from the server." Server Actions enforce
  // auth themselves via features/auth/guards.ts.
  if (
    (request.method !== "GET" && request.method !== "HEAD") ||
    request.headers.has("next-action")
  ) {
    return response
  }

  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/")
  const isAdminPublic =
    pathname === "/admin/login" ||
    pathname.startsWith("/admin/login/") ||
    pathname === "/admin/forgot-password" ||
    pathname.startsWith("/admin/forgot-password/") ||
    pathname === "/admin/reset-password" ||
    pathname.startsWith("/admin/reset-password/")
  const isAccount = pathname === "/account" || pathname.startsWith("/account/")
  const needsLogin = (isAdmin && !isAdminPublic) || isAccount

  if (user && isAdmin && !isAdminPublic) {
    if (hasValidPasswordResetCookie(request.cookies.get("kk_pw_reset")?.value, "admin", user.id)) {
      const url = request.nextUrl.clone()
      url.pathname = "/admin/reset-password"
      url.search = ""
      const redirectResponse = NextResponse.redirect(url)
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie)
      }
      return redirectResponse
    }
    const signedInAt = user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : NaN
    if (!Number.isNaN(signedInAt) && Date.now() - signedInAt >= ADMIN_SESSION_MAX_AGE_MS) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = "/admin/login"
      url.search = "?reason=session-expired"
      const redirectResponse = NextResponse.redirect(url)
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie)
      }
      redirectResponse.cookies.delete("kk_admin_pin_at")
      return redirectResponse
    }
  }

  if (user && isAccount) {
    if (hasValidPasswordResetCookie(request.cookies.get("kk_cust_pw_reset")?.value, "customer", user.id)) {
      const url = request.nextUrl.clone()
      url.pathname = "/login"
      url.search = "?mode=reset-password"
      const redirectResponse = NextResponse.redirect(url)
      for (const cookie of response.cookies.getAll()) {
        redirectResponse.cookies.set(cookie)
      }
      return redirectResponse
    }
  }

  if (!user && needsLogin) {
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? "/admin/login" : "/login"
    const fullTarget = `${pathname}${search}`
    const isDefaultLanding = isAdmin && fullTarget === "/admin"
    if (!isDefaultLanding) {
      url.search = `?next=${encodeURIComponent(fullTarget)}`
    } else {
      url.search = ""
    }
    const redirectResponse = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  return response
}

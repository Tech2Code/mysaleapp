import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isSupabaseConfigured, supabaseConfig } from "./config"

/**
 * Refreshes the Supabase auth cookie on every matched request so Server
 * Components always see a valid session. Also does a cheap, optimistic
 * redirect for protected areas — the real authorization check lives in
 * features/auth/guards.ts and in database RLS.
 */
export async function updateSession(request: NextRequest) {
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

  const { pathname, search } = request.nextUrl
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

  if (!user && needsLogin) {
    const url = request.nextUrl.clone()
    url.pathname = isAdmin ? "/admin/login" : "/login"
    const fullTarget = `${pathname}${search}`
    const isDefaultLanding = (isAdmin && fullTarget === "/admin") || (!isAdmin && fullTarget === "/account")
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

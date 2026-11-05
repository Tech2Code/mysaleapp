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

  const { pathname } = request.nextUrl
  const needsLogin =
    (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) ||
    pathname.startsWith("/account")

  if (!user && needsLogin) {
    const url = request.nextUrl.clone()
    url.pathname = pathname.startsWith("/admin") ? "/admin/login" : "/login"
    url.search = `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  return response
}

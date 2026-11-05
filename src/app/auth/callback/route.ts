import { NextResponse, type NextRequest } from "next/server"
import { safeNextPath } from "@/lib/safe-redirect"
import { getServerSupabase } from "@/lib/supabase/server"

/** Google OAuth lands here; we swap the one-time code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"), "/account/orders")

  if (code) {
    const supabase = await getServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, origin))
  }

  // An expired/used admin link (password reset, email confirmation) goes back to the admin screens.
  if (next.startsWith("/admin")) return NextResponse.redirect(new URL("/admin/forgot-password?error=expired", origin))
  return NextResponse.redirect(new URL("/login?error=auth", origin))
}

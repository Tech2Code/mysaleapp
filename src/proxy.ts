import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // "/" is included only to catch Supabase fallback redirects (/?code=... or /?error=...)
  // and immediately forward them to /auth/callback; normal "/" requests return immediately.
  matcher: ["/", "/admin/:path*", "/account/:path*", "/checkout", "/auth/:path*", "/login"],
}

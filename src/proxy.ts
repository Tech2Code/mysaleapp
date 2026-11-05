import type { NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only run where a session matters; public catalog pages stay fully static.
  matcher: ["/admin/:path*", "/account/:path*", "/checkout", "/auth/:path*", "/login"],
}

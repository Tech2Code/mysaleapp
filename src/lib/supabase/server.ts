import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"
import { supabaseConfig } from "./config"

/**
 * Request-scoped client that acts as the signed-in user (RLS applies).
 * Reads cookies, so only call it inside a <Suspense> boundary, a Server Action
 * or a Route Handler — never inside "use cache".
 */
export async function getServerSupabase() {
  // Supabase's auth code checks token expiry with Date.now(). Cache Components
  // forbids that during prerender, so always defer to real request time first.
  await connection()
  const cookieStore = await cookies()

  return createServerClient(supabaseConfig.url, supabaseConfig.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // The session is refreshed by proxy.ts instead, so this is safe to ignore.
        }
      },
    },
  })
}

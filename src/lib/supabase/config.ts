const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

/**
 * The app runs in "demo mode" (built-in sample products, no orders/login)
 * until these two env vars are set. See README → Setup.
 */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes("your-project")
)

export const supabaseConfig = { url, anonKey } as const

const supabaseHost = (() => {
  try {
    return url ? new URL(url).hostname : null
  } catch {
    return null
  }
})()

/**
 * Only return avatar URLs whose host/path match next.config.ts `images.remotePatterns`,
 * so an unexpected or tampered `user_metadata.avatar_url` never crashes `<Image>` at render time.
 */
export function safeAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== "https:") return null
    if (parsed.hostname === "lh3.googleusercontent.com") return parsed.toString()
    if (supabaseHost && parsed.hostname === supabaseHost && parsed.pathname.startsWith("/storage/v1/object/public/")) {
      return parsed.toString()
    }
    return null
  } catch {
    return null
  }
}

/**
 * Strips the trailing ` (Admin)` badge that migration 0048 adds to `auth.users` metadata
 * for the Supabase Dashboard "Display name" column, so app UI forms and menus always show
 * the person's clean name.
 */
export function cleanMetaName(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined
  const cleaned = raw.replace(/\s*\(Admin\)\s*$/i, "").trim()
  if (!cleaned || cleaned.toLowerCase() === "admin") return undefined
  return cleaned
}

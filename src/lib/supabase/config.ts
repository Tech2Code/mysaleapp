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

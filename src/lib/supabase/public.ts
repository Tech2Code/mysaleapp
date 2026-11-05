import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabaseConfig } from "./config"

let client: SupabaseClient | null = null

/**
 * Cookie-less, anonymous client for PUBLIC data (products, categories).
 * Safe to call inside `"use cache"` functions because it never reads the request.
 * Returns null in demo mode.
 */
export function getPublicSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  client ??= createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isSupabaseConfigured, supabaseConfig } from "./config"

let client: SupabaseClient | null = null

/** Browser client (singleton). Returns null in demo mode. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  client ??= createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey)
  return client
}

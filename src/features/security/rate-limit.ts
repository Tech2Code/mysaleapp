import "server-only"
import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

export const RATE_LIMIT_MESSAGE = "Too many attempts. Please try again in a few minutes."

/**
 * Limits (max hits / window per scope) are defined in the database, in check_rate_limit() (migration 0021),
 * so a caller of the public RPC cannot choose its own. Scopes: track-order, submit-payment, update-delivery,
 * cancel-order, request-return, withdraw-return, place-order, login, pincode.
 */

// Set RATE_LIMIT_SALT in production: with only the built-in default, someone who knows an IP and can call the
// public RPC could compute (and burn) that IP's bucket key.
if (process.env.NODE_ENV === "production" && !process.env.RATE_LIMIT_SALT) {
  console.warn("[rate-limit] RATE_LIMIT_SALT is not set; falling back to the public default salt. Set it in the environment.")
}

const hash = (value: string) =>
  createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? "mysaleapp-rl-v1"}:${value}`)
    .digest("hex")
    .slice(0, 32)

/** The caller's IP from the platform's trusted header first; null when none is present (never a shared "unknown" bucket). */
async function clientIp(): Promise<string | null> {
  const h = await headers()
  const ip =
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim()
  return ip || null
}

/**
 * True when this caller (hashed IP, plus an optional extra part such as an email) has exceeded the limit for
 * `scope`. Call it BEFORE touching the database.
 * Fails open: if the limiter itself breaks, or no IP can be determined (and there is no `extra` to key on),
 * real customers are never blocked.
 */
export async function limited(scope: string, extra?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  try {
    const ip = await clientIp()
    if (!ip && !extra) return false
    const key = hash(`${ip ?? "noip"}|${extra?.toLowerCase() ?? ""}`)
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.rpc("check_rate_limit", { p_scope: scope, p_key: key })
    if (error) {
      console.warn(`[rate-limit] check failed for scope "${scope}" (${error.code ?? "error"}); allowing`)
      return false
    }
    return data === false
  } catch {
    console.warn(`[rate-limit] check threw for scope "${scope}"; allowing`)
    return false
  }
}

import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { headers } from "next/headers"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

export const RATE_LIMIT_MESSAGE = "Too many attempts. Please try again in a few minutes."

/**
 * Limits (max hits / window per scope) are defined in the database, in check_rate_limit() (migration 0021),
 * so a caller of the public RPC cannot choose its own. Scopes: track-order, submit-payment, update-delivery, password-reset (0040),
 * cancel-order, request-return, withdraw-return, place-order, login, pincode.
 */

// Set RATE_LIMIT_SALT in production: without a shared secret across serverless instances, each cold instance uses
// an unpredictable random salt rather than a public constant (so callers of the public RPC still can't precompute keys).
const FALLBACK_SALT =
  process.env.NODE_ENV === "production" && !process.env.RATE_LIMIT_SALT
    ? (() => {
        console.warn("[rate-limit] RATE_LIMIT_SALT is not set; using a per-instance random salt. Set RATE_LIMIT_SALT in the environment.")
        return randomBytes(32).toString("hex")
      })()
    : "mysaleapp-rl-v1"

const hash = (value: string) =>
  createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT || FALLBACK_SALT}:${value}`)
    .digest("hex")
    .slice(0, 32)

/** The caller's IP from the platform's trusted header first; null when none is present (never a shared "unknown" bucket). */
async function clientIp(): Promise<string | null> {
  const h = await headers()
  const vercelIp = process.env.VERCEL === "1" ? h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : undefined
  if (vercelIp) return vercelIp
  const realIp = h.get("cf-connecting-ip")?.trim() || h.get("x-real-ip")?.trim()
  if (realIp) return realIp
  // Standard reverse proxies append the connecting client IP to X-Forwarded-For; the leftmost entry is client-controlled.
  const xff = h.get("x-forwarded-for")
  if (!xff) return null
  const parts = xff
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.at(-1) || null
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

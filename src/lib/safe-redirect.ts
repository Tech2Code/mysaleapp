const AUTH_LOOP_PREFIXES = ["/login", "/admin/login", "/admin/forgot-password", "/auth"]

function isAuthLoopTarget(pathname: string): boolean {
  return AUTH_LOOP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/**
 * Only allow same-site relative paths as post-login redirects. Blocks open-redirects such as
 * `//evil.com`, `https://evil.com`, `/\evil.com` and `/<TAB>/evil.com` (URL parsers silently
 * drop tabs/newlines, which would turn that last one into `//evil.com`), as well as self-redirect
 * loops back onto login/callback screens.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || next.length > 500) return fallback
  if (!next.startsWith("/") || next.startsWith("//")) return fallback
  // backslashes and control characters are never part of a legitimate in-app path
  for (const ch of next) {
    const code = ch.charCodeAt(0)
    if (ch === "\\" || code <= 0x1f || code === 0x7f) return fallback
  }
  try {
    const base = "http://safe-redirect.invalid"
    const parsed = new URL(next, base)
    if (parsed.origin !== base) return fallback
    if (isAuthLoopTarget(parsed.pathname)) return fallback
  } catch {
    return fallback
  }
  return next
}

/**
 * Render-side guard for external links (`trackingUrl`, social links): allows only `http:` and `https:`
 * so an unexpected `javascript:` or `data:` string in stored data can never become an executable `<a href>`.
 */
export function safeExternalUrl(raw: string | null | undefined, httpsOnly = false): string | null {
  if (!raw || typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol === "https:") return parsed.toString()
    if (!httpsOnly && parsed.protocol === "http:") return parsed.toString()
    return null
  } catch {
    return null
  }
}

/**
 * Only allow same-site relative paths as post-login redirects. Blocks open-redirects such as
 * `//evil.com`, `https://evil.com`, `/\evil.com` and `/<TAB>/evil.com` (URL parsers silently
 * drop tabs/newlines, which would turn that last one into `//evil.com`).
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
    if (new URL(next, base).origin !== base) return fallback
  } catch {
    return fallback
  }
  return next
}

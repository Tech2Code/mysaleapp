/**
 * Only allow same-site relative paths as post-login redirects
 * (blocks open-redirects like `//evil.com` or `https://evil.com`).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback
  return next
}

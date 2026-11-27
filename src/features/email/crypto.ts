import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const ENC_PREFIX = "v1"

function getBaseServerSecret(): string {
  const configured =
    process.env.EMAIL_ENCRYPTION_KEY?.trim() ||
    process.env.COOKIE_SECRET?.trim() ||
    process.env.RATE_LIMIT_SALT?.trim() ||
    process.env.CRON_SECRET?.trim()

  if (configured) return configured
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing server secret (set EMAIL_ENCRYPTION_KEY, COOKIE_SECRET, RATE_LIMIT_SALT, or CRON_SECRET).")
  }
  return "kalakriti-local-dev-email-key"
}

/**
 * Derives a 32-byte AES-256 key from the server-only secret environment variables.
 * Never exposed to the client.
 */
function getEncryptionKey(): Buffer {
  return createHash("sha256").update(`kk-email-secret:${getBaseServerSecret()}`).digest()
}

/**
 * Server-only secret passed to SECURITY DEFINER email/reset RPCs so browser clients
 * using the public anon key cannot invoke those RPCs directly.
 */
export function getServerRpcSecret(): string {
  return createHash("sha256").update(`kk-rpc-auth:${getBaseServerSecret()}`).digest("hex")
}

/** SHA-256 hash stored in `public.email_settings.server_rpc_secret_hash` for RPC authentication. */
export function hashServerRpcSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

/** Encrypts a Gmail App Password with AES-256-GCM before storing it in PostgreSQL. */
export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_PREFIX}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/** Decrypts a stored AES-256-GCM secret. Returns null if malformed or key mismatch. */
export function decryptSecret(encoded: string | null | undefined): string | null {
  if (!encoded || typeof encoded !== "string") return null
  const parts = encoded.split(":")
  if (parts.length !== 4 || parts[0] !== ENC_PREFIX) return null
  const [, ivHex, tagHex, dataHex] = parts
  if (!ivHex || !tagHex || !dataHex) return null
  try {
    const key = getEncryptionKey()
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
    decipher.setAuthTag(Buffer.from(tagHex, "hex"))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ])
    return decrypted.toString("utf8")
  } catch {
    return null
  }
}

/** Generates a 32-byte cryptographically random reset token (64 hex chars). */
export function generateResetToken(): string {
  return randomBytes(32).toString("hex")
}

/** Hashes a raw reset token with SHA-256 so only the hash is ever stored in PostgreSQL. */
export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken.trim()).digest("hex")
}

/** Normalizes a Google App Password by removing spaces/hyphens (Google shows 4 groups of 4 chars). */
export function normalizeGmailAppPassword(raw: string): string {
  return raw.replace(/[\s-]+/g, "").trim()
}

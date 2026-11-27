import "server-only"
import nodemailer from "nodemailer"
import { decryptSecret, normalizeGmailAppPassword } from "./crypto"

export type ResolvedSmtpConfig = {
  gmailUser: string
  gmailAppPassword: string
  senderName?: string | null
  replyTo?: string | null
}

export type EncryptedMailerPayload = {
  gmailUser?: string | null
  gmailAppPasswordEnc?: string | null
  senderName?: string | null
  replyTo?: string | null
}

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string }

/** Maps low-level Nodemailer / Gmail SMTP errors into clear, actionable messages for admins. */
export function describeSmtpError(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string } | null
  const code = e?.code ?? ""
  const responseCode = e?.responseCode ?? 0
  const msg = (e?.message ?? "").toLowerCase()

  if (
    code === "EAUTH" ||
    responseCode === 535 ||
    responseCode === 534 ||
    msg.includes("invalid login") ||
    msg.includes("username and password not accepted") ||
    msg.includes("application-specific password required")
  ) {
    return "Gmail rejected the email or App Password. Turn on 2-Step Verification in your Google Account and paste a 16-character Gmail App Password (not your regular Gmail password)."
  }
  if (code === "ETIMEDOUT" || code === "ECONNECTION" || code === "ESOCKET" || msg.includes("timeout")) {
    return "Could not connect to Gmail SMTP (smtp.gmail.com:465). Check your internet connection or firewall and try again."
  }
  if (code === "EENVELOPE" || responseCode === 550 || responseCode === 553) {
    return "Gmail rejected the sender or recipient address. Check that both email addresses are valid."
  }
  if (responseCode === 421 || responseCode === 454 || msg.includes("daily user sending limit")) {
    return "Gmail temporarily rate-limited sending for this account. Please try again in a few minutes."
  }
  return "Could not send email via Gmail SMTP. Check your Gmail address and App Password and try again."
}

/** Decrypts a mailer payload returned by our DB RPCs into a ready-to-use SMTP config. */
export function resolveMailerPayload(payload: EncryptedMailerPayload | null | undefined): ResolvedSmtpConfig | null {
  if (!payload?.gmailUser || !payload.gmailAppPasswordEnc) return null
  const appPassword = decryptSecret(payload.gmailAppPasswordEnc)
  if (!appPassword) return null
  return {
    gmailUser: payload.gmailUser.trim(),
    gmailAppPassword: normalizeGmailAppPassword(appPassword),
    senderName: payload.senderName?.trim() || null,
    replyTo: payload.replyTo?.trim() || null,
  }
}

function formatFromHeader(senderName: string | null | undefined, gmailUser: string): string {
  const cleanName = (senderName ?? "").replace(/[\r\n"<>]+/g, "").trim()
  if (!cleanName) return gmailUser
  return `"${cleanName}" <${gmailUser}>`
}

/**
 * Sends an email via Gmail SMTP (`smtp.gmail.com:465` over TLS) using a Gmail App Password.
 * Never logs or exposes credentials.
 */
export async function sendEmailWithGmailSmtp(
  config: ResolvedSmtpConfig,
  message: {
    to: string
    subject: string
    html: string
    text: string
  }
): Promise<SendEmailResult> {
  const user = config.gmailUser.trim()
  const pass = normalizeGmailAppPassword(config.gmailAppPassword)
  if (!user || !pass) {
    return { ok: false, error: "Gmail address and App Password are required." }
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })

  try {
    const info = await transporter.sendMail({
      from: formatFromHeader(config.senderName, user),
      to: message.to.trim(),
      replyTo: config.replyTo?.trim() || undefined,
      subject: message.subject,
      html: message.html,
      text: message.text,
    })
    return { ok: true, messageId: info.messageId ?? "" }
  } catch (err) {
    return { ok: false, error: describeSmtpError(err) }
  } finally {
    transporter.close()
  }
}

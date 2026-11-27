import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { sendMailMock, closeMock, createTransportMock } = vi.hoisted(() => {
  const sendMail = vi.fn()
  const close = vi.fn()
  const createTransport = vi.fn(() => ({
    sendMail,
    close,
  }))
  return { sendMailMock: sendMail, closeMock: close, createTransportMock: createTransport }
})

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}))

import {
  decryptSecret,
  encryptSecret,
  generateResetToken,
  hashResetToken,
  normalizeGmailAppPassword,
} from "./crypto"
import { describeSmtpError, resolveMailerPayload, sendEmailWithGmailSmtp } from "./mailer"
import { cleanAppPasswordInput, emailSettingsSchema, sendTestEmailSchema } from "./schema"
import {
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildSignupVerifyEmail,
  buildTestEmail,
  buildWelcomeEmail,
} from "./templates"

describe("email crypto helpers", () => {
  it("encrypts and decrypts Gmail App Passwords cleanly with AES-256-GCM", () => {
    const raw = "abcd efgh ijkl mnop"
    const normalized = normalizeGmailAppPassword(raw)
    expect(normalized).toBe("abcdefghijklmnop")

    const encrypted = encryptSecret(normalized)
    expect(encrypted.startsWith("v1:")).toBe(true)
    expect(encrypted).not.toContain(normalized)
    expect(decryptSecret(encrypted)).toBe(normalized)
  })

  it("rejects tampered or malformed ciphertext", () => {
    const encrypted = encryptSecret("abcdefghijklmnop")
    const parts = encrypted.split(":")
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3].slice(0, -2)}ff`
    expect(decryptSecret(tampered)).toBeNull()
    expect(decryptSecret("invalid-format")).toBeNull()
    expect(decryptSecret(null)).toBeNull()
  })

  it("generates unique 64-char hex reset tokens and deterministic SHA-256 hashes", () => {
    const t1 = generateResetToken()
    const t2 = generateResetToken()
    expect(t1).toMatch(/^[0-9a-f]{64}$/)
    expect(t2).toMatch(/^[0-9a-f]{64}$/)
    expect(t1).not.toBe(t2)

    const h1 = hashResetToken(t1)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
    expect(hashResetToken(`  ${t1}  `)).toBe(h1)
  })
})

describe("email settings validation schemas", () => {
  it("normalizes spaced 16-char Google App Passwords", () => {
    expect(cleanAppPasswordInput("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop")
    const parsed = emailSettingsSchema.safeParse({
      enabled: true,
      gmailUser: "shop@gmail.com",
      gmailAppPassword: "abcd efgh ijkl mnop",
      senderName: "Kalakriti",
      replyTo: "help@kalakriti.in",
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.gmailAppPassword).toBe("abcdefghijklmnop")
    }
  })

  it("rejects App Passwords shorter than 16 characters", () => {
    const parsed = emailSettingsSchema.safeParse({
      enabled: true,
      gmailUser: "shop@gmail.com",
      gmailAppPassword: "shortpassword",
      senderName: "",
      replyTo: "",
    })
    expect(parsed.success).toBe(false)
  })

  it("requires gmailUser when enabled is true", () => {
    const parsed = emailSettingsSchema.safeParse({
      enabled: true,
      gmailUser: "",
      gmailAppPassword: "",
      senderName: "",
      replyTo: "",
    })
    expect(parsed.success).toBe(false)
  })

  it("allows empty gmailAppPassword when keeping existing saved password", () => {
    const parsed = emailSettingsSchema.safeParse({
      enabled: true,
      gmailUser: "shop@gmail.com",
      gmailAppPassword: "",
      senderName: "Kalakriti",
      replyTo: "",
    })
    expect(parsed.success).toBe(true)
  })

  it("validates sendTestEmailSchema recipient", () => {
    expect(
      sendTestEmailSchema.safeParse({
        recipientEmail: "owner@gmail.com",
        gmailUser: "shop@gmail.com",
        gmailAppPassword: "",
        senderName: "",
        replyTo: "",
      }).success
    ).toBe(true)
    expect(
      sendTestEmailSchema.safeParse({
        recipientEmail: "not-an-email",
        gmailUser: "",
        gmailAppPassword: "",
        senderName: "",
        replyTo: "",
      }).success
    ).toBe(false)
  })
})

describe("HTML email templates", () => {
  it("builds table-based, inline-styled password reset emails without flexbox/grid and escapes HTML", () => {
    const doc = buildPasswordResetEmail({
      shopName: "Kalakriti <Crafts>",
      recipientName: "Aarav & Co",
      resetUrl: "https://example.com/login?mode=reset-password&token=abc123",
      scope: "customer",
      expiresMinutes: 30,
    })
    expect(doc.subject).toContain("Reset your Kalakriti <Crafts> password")
    expect(doc.html).toContain('cellpadding="0" cellspacing="0" border="0"')
    expect(doc.html).not.toMatch(/display:\s*(flex|grid)/i)
    expect(doc.html).toContain("Kalakriti &lt;Crafts&gt;")
    expect(doc.html).toContain("Hi Aarav &amp; Co,")
    expect(doc.html).toContain("https://example.com/login?mode=reset-password&amp;token=abc123")
    expect(doc.text).toContain("https://example.com/login?mode=reset-password&token=abc123")
  })

  it("builds admin password reset, password changed, and test emails cleanly", () => {
    const adminReset = buildPasswordResetEmail({
      shopName: "Kalakriti",
      recipientName: "Owner",
      resetUrl: "https://example.com/admin/reset-password?token=xyz",
      scope: "admin",
    })
    expect(adminReset.subject).toContain("admin password")

    const changed = buildPasswordChangedEmail({
      shopName: "Kalakriti",
      recipientName: "Owner",
      scope: "admin",
      loginUrl: "https://example.com/admin/login",
    })
    expect(changed.subject).toContain("admin password was changed")
    expect(changed.html).not.toMatch(/display:\s*(flex|grid)/i)

    const testMail = buildTestEmail({
      shopName: "Kalakriti",
      senderEmail: "shop@gmail.com",
      recipientEmail: "owner@gmail.com",
      testedAt: "27 Nov 2026, 4:30 pm IST",
    })
    expect(testMail.subject).toContain("Gmail SMTP test email")
    expect(testMail.html).toContain("shop@gmail.com")
    expect(testMail.html).not.toMatch(/display:\s*(flex|grid)/i)

    const welcomeMail = buildWelcomeEmail({
      shopName: "Kalakriti",
      recipientName: "Meera",
      shopUrl: "https://example.com",
    })
    expect(welcomeMail.subject).toBe("Welcome to Kalakriti!")
    expect(welcomeMail.html).toContain("Hi Meera,")
    expect(welcomeMail.html).not.toMatch(/display:\s*(flex|grid)/i)

    const verifyMail = buildSignupVerifyEmail({
      shopName: "Kalakriti",
      recipientName: "Meera",
      verifyUrl: "https://example.com/login?mode=verify-email&token=tok123",
      expiresHours: 24,
    })
    expect(verifyMail.subject).toContain("Verify your Kalakriti email")
    expect(verifyMail.html).toContain("mode=verify-email&amp;token=tok123")
    expect(verifyMail.html).not.toMatch(/display:\s*(flex|grid)/i)
  })
})

describe("Gmail SMTP mailer", () => {
  it("resolves encrypted mailer payload and sends via smtp.gmail.com:465", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "<msg-1@gmail.com>" })
    const enc = encryptSecret("abcdefghijklmnop")
    const config = resolveMailerPayload({
      gmailUser: "shop@gmail.com",
      gmailAppPasswordEnc: enc,
      senderName: "Kalakriti",
      replyTo: "support@kalakriti.in",
    })
    expect(config).not.toBeNull()

    const res = await sendEmailWithGmailSmtp(config!, {
      to: "customer@gmail.com",
      subject: "Test",
      html: "<p>Hello</p>",
      text: "Hello",
    })
    expect(res).toEqual({ ok: true, messageId: "<msg-1@gmail.com>" })
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: "shop@gmail.com", pass: "abcdefghijklmnop" },
      })
    )
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Kalakriti" <shop@gmail.com>',
        to: "customer@gmail.com",
        replyTo: "support@kalakriti.in",
        subject: "Test",
      })
    )
    expect(closeMock).toHaveBeenCalled()
  })

  it("translates Gmail auth and timeout errors into clear guidance", () => {
    expect(describeSmtpError({ code: "EAUTH", responseCode: 535 })).toContain("16-character Gmail App Password")
    expect(describeSmtpError({ code: "ETIMEDOUT" })).toContain("smtp.gmail.com:465")
    expect(describeSmtpError({ responseCode: 550 })).toContain("rejected the sender or recipient")
    expect(describeSmtpError({ responseCode: 421 })).toContain("rate-limited")
  })
})

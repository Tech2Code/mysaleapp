import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const {
  rpcMock,
  signInWithPasswordMock,
  signUpMock,
  resetPasswordForEmailMock,
  fromMock,
  cookieSetMock,
  cookieDeleteMock,
  cookieGetMock,
  sendEmailMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signUpMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  fromMock: vi.fn(),
  cookieSetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
  cookieGetMock: vi.fn(),
  sendEmailMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: cookieSetMock,
    delete: cookieDeleteMock,
    get: cookieGetMock,
  }),
  headers: async () => new Headers({ origin: "http://localhost:3000" }),
}))

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: true,
  cleanMetaName: (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
  safeAvatarUrl: () => null,
}))

vi.mock("@/lib/supabase/server", () => ({
  getServerSupabase: async () => ({
    rpc: rpcMock,
    from: fromMock,
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      resetPasswordForEmail: resetPasswordForEmailMock,
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  }),
}))

vi.mock("@/features/wishlist/actions", () => ({
  syncWishlistForUser: vi.fn(async (_uid: string, ids?: string[]) => ({ ok: true, data: ids ?? [] })),
}))

vi.mock("@/features/security/rate-limit", () => ({
  RATE_LIMIT_MESSAGE: "Too many attempts",
  limited: vi.fn(async () => false),
}))

vi.mock("@/features/settings/queries", () => ({
  getStoreSettings: vi.fn(async () => ({
    shopName: "Kalakriti",
    email: "hello@kalakriti.in",
  })),
}))

vi.mock("@/features/email/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/email/mailer")>()
  return {
    ...actual,
    sendEmailWithGmailSmtp: sendEmailMock,
  }
})

import { encryptSecret } from "@/features/email/crypto"
import {
  requestCustomerPasswordReset,
  resetCustomerPassword,
  signInCustomer,
  signUpCustomer,
} from "@/features/auth/actions"
import { requestPasswordReset, resetAdminPassword } from "@/features/auth/account-actions"

describe("end-to-end Gmail SMTP forgot & reset password flows", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { full_name: "Aarav Sharma", avatar_url: null } }),
        }),
      }),
      upsert: async () => ({ error: null }),
    })
  })

  it("sends customer forgot-password email via Gmail SMTP with a one-time token link", async () => {
    const enc = encryptSecret("abcdefghijklmnop")
    rpcMock.mockResolvedValueOnce({
      data: {
        smtpEnabled: true,
        found: true,
        email: "customer@example.com",
        recipientName: "Aarav",
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: "help@kalakriti.in",
        },
      },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m1>" })

    const res = await requestCustomerPasswordReset({ email: "customer@example.com", next: "/account" })
    expect(res).toEqual({ ok: true })
    expect(rpcMock).toHaveBeenCalledWith(
      "create_password_reset_token",
      expect.objectContaining({
        p_email: "customer@example.com",
        p_scope: "customer",
        p_server_secret: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_ttl_minutes: 30,
      })
    )
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    const [smtpCfg, mailDoc] = sendEmailMock.mock.calls[0]
    expect(smtpCfg.gmailUser).toBe("shop@gmail.com")
    expect(smtpCfg.gmailAppPassword).toBe("abcdefghijklmnop")
    expect(mailDoc.to).toBe("customer@example.com")
    expect(mailDoc.text).toContain("/login?mode=reset-password&token=")
    expect(mailDoc.text).toContain("next=%2Faccount")
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled()
  })

  it("does not leak unknown emails and falls back to Supabase when Gmail SMTP is disabled", async () => {
    // Unknown email while SMTP enabled -> ok: true without sending email
    rpcMock.mockResolvedValueOnce({
      data: { smtpEnabled: true, found: false },
      error: null,
    })
    const resUnknown = await requestCustomerPasswordReset({ email: "nobody@example.com" })
    expect(resUnknown).toEqual({ ok: true })
    expect(sendEmailMock).not.toHaveBeenCalled()

    // SMTP disabled -> falls back to Supabase resetPasswordForEmail
    rpcMock.mockResolvedValueOnce({
      data: { smtpEnabled: false, found: false },
      error: null,
    })
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: null })
    const resFallback = await requestCustomerPasswordReset({ email: "customer@example.com" })
    expect(resFallback).toEqual({ ok: true })
    expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1)
  })

  it("consumes customer reset token, signs in user, and sends security confirmation email", async () => {
    const enc = encryptSecret("abcdefghijklmnop")
    rpcMock.mockResolvedValueOnce({
      data: {
        ok: true,
        email: "customer@example.com",
        recipientName: "Aarav",
        reactivated: false,
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: null,
        },
      },
      error: null,
    })
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "u-1", email: "customer@example.com", user_metadata: {} } },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m2>" })

    const rawToken = "a".repeat(64)
    const res = await resetCustomerPassword({
      next: "NewPass123",
      confirm: "NewPass123",
      token: rawToken,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.user.email).toBe("customer@example.com")
    }
    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: "customer@example.com",
      password: "NewPass123",
    })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][1].subject).toContain("password was updated")
  })

  it("rejects reusing the same password during customer token reset", async () => {
    rpcMock.mockResolvedValueOnce({
      data: { ok: false, code: "same_password" },
      error: null,
    })
    const res = await resetCustomerPassword({
      next: "OldPass123",
      confirm: "OldPass123",
      token: "b".repeat(64),
    })
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toContain("Use a new password")
    }
    expect(signInWithPasswordMock).not.toHaveBeenCalled()
  })

  it("sends admin forgot-password email and completes admin token reset with PIN unlock stamp", async () => {
    const enc = encryptSecret("abcdefghijklmnop")
    rpcMock.mockResolvedValueOnce({
      data: {
        smtpEnabled: true,
        found: true,
        email: "admin@kalakriti.in",
        recipientName: "Owner",
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: null,
        },
      },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m3>" })

    const reqRes = await requestPasswordReset({ email: "admin@kalakriti.in" })
    expect(reqRes).toEqual({ ok: true })
    expect(sendEmailMock.mock.calls[0][1].text).toContain("/admin/reset-password?token=")

    // Now consume the admin token
    rpcMock.mockResolvedValueOnce({
      data: {
        ok: true,
        userId: "admin-1",
        email: "admin@kalakriti.in",
        recipientName: "Owner",
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: null,
        },
      },
      error: null,
    })
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "admin-1", email: "admin@kalakriti.in", user_metadata: {} } },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m4>" })

    const resetRes = await resetAdminPassword({
      next: "AdminNew123",
      confirm: "AdminNew123",
      token: "c".repeat(64),
    })
    expect(resetRes.ok).toBe(true)
    expect(cookieSetMock).toHaveBeenCalledWith(
      "kk_admin_pin_at",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    )
    expect(sendEmailMock).toHaveBeenCalledTimes(2)
    expect(sendEmailMock.mock.calls[1][1].subject).toContain("admin password was changed")
  })

  it("sends a Gmail SMTP welcome email on immediate customer signup and allows login", async () => {
    const enc = encryptSecret("abcdefghijklmnop")
    signUpMock.mockResolvedValueOnce({
      data: {
        user: { id: "u-new", email: "newuser@example.com", user_metadata: { full_name: "Meera" } },
        session: { access_token: "tok" },
      },
      error: null,
    })
    rpcMock.mockResolvedValueOnce({
      data: {
        smtpEnabled: true,
        email: "newuser@example.com",
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: null,
        },
      },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m-welcome>" })

    const signUpRes = await signUpCustomer({
      fullName: "Meera Nair",
      phone: "9876543210",
      email: "newuser@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      acceptTerms: true,
    })
    expect(signUpRes.ok).toBe(true)
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][1].subject).toBe("Welcome to Kalakriti!")

    // Verify customer login works smoothly with the created credentials
    signInWithPasswordMock.mockResolvedValueOnce({
      data: { user: { id: "u-new", email: "newuser@example.com", user_metadata: { full_name: "Meera Nair" } } },
      error: null,
    })
    rpcMock.mockResolvedValueOnce({ data: false, error: null })
    const loginRes = await signInCustomer({ email: "newuser@example.com", password: "Password123" })
    expect(loginRes.ok).toBe(true)
    if (loginRes.ok) {
      expect(loginRes.data.user.email).toBe("newuser@example.com")
    }
  })

  it("sends a Gmail SMTP verification email when signup requires email confirmation", async () => {
    const enc = encryptSecret("abcdefghijklmnop")
    signUpMock.mockResolvedValueOnce({
      data: {
        user: {
          id: "u-confirm",
          email: "confirm@example.com",
          identities: [{ id: "id-1" }],
          user_metadata: { full_name: "Rohan" },
        },
        session: null,
      },
      error: null,
    })
    rpcMock.mockResolvedValueOnce({
      data: {
        smtpEnabled: true,
        email: "confirm@example.com",
        mailer: {
          gmailUser: "shop@gmail.com",
          gmailAppPasswordEnc: enc,
          senderName: "Kalakriti",
          replyTo: null,
        },
      },
      error: null,
    })
    sendEmailMock.mockResolvedValueOnce({ ok: true, messageId: "<m-verify>" })

    const signUpRes = await signUpCustomer({
      fullName: "Rohan Verma",
      phone: "9876543210",
      email: "confirm@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      acceptTerms: true,
    })
    expect(signUpRes).toEqual({ ok: true, data: { needsEmailConfirmation: true } })
    expect(sendEmailMock).toHaveBeenCalledTimes(1)
    expect(sendEmailMock.mock.calls[0][1].subject).toContain("Verify your Kalakriti email")
    expect(sendEmailMock.mock.calls[0][1].text).toContain("/login?mode=verify-email&token=")
  })
})

import { z } from "zod"
import { v } from "@/lib/validation"

export type EmailSettingsPublic = {
  enabled: boolean
  gmailUser: string | null
  hasAppPassword: boolean
  senderName: string | null
  replyTo: string | null
  lastTestAt: string | null
  lastTestStatus: "ok" | "error" | null
  lastTestError: string | null
  updatedAt: string | null
  /** False if migration 0070 has not been pushed to Supabase yet. */
  migrationReady: boolean
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettingsPublic = {
  enabled: false,
  gmailUser: null,
  hasAppPassword: false,
  senderName: null,
  replyTo: null,
  lastTestAt: null,
  lastTestStatus: null,
  lastTestError: null,
  updatedAt: null,
  migrationReady: true,
}

export function cleanAppPasswordInput(raw: string): string {
  return raw.replace(/[\s-]+/g, "").trim()
}

export const emailSettingsSchema = z
  .object({
    enabled: z.boolean(),
    gmailUser: v.optionalEmail(),
    /** Optional on update: leave empty to keep the currently saved App Password. */
    gmailAppPassword: z.preprocess(
      (x) => (typeof x === "string" ? cleanAppPasswordInput(x) : ""),
      z.string().max(64, "App password looks too long")
    ),
    senderName: v.optionalText(80),
    replyTo: v.optionalEmail(),
  })
  .superRefine((val, ctx) => {
    if (val.gmailAppPassword && val.gmailAppPassword.length < 16) {
      ctx.addIssue({
        code: "custom",
        path: ["gmailAppPassword"],
        message: "Gmail App Passwords are 16 characters (spaces are ignored).",
      })
    }
    if (val.enabled && !val.gmailUser) {
      ctx.addIssue({
        code: "custom",
        path: ["gmailUser"],
        message: "Enter your Gmail address before enabling Gmail SMTP.",
      })
    }
  })

export type EmailSettingsInput = z.input<typeof emailSettingsSchema>
export type EmailSettingsValues = z.output<typeof emailSettingsSchema>

export const sendTestEmailSchema = z.object({
  recipientEmail: v.email(),
  gmailUser: v.optionalEmail(),
  gmailAppPassword: z.preprocess(
    (x) => (typeof x === "string" ? cleanAppPasswordInput(x) : ""),
    z.string().max(64, "App password looks too long")
  ),
  senderName: v.optionalText(80),
  replyTo: v.optionalEmail(),
})

export type SendTestEmailInput = z.input<typeof sendTestEmailSchema>

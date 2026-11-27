"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { logAdminAction } from "@/features/security/audit"
import { RATE_LIMIT_MESSAGE, limited } from "@/features/security/rate-limit"
import { getStoreSettings } from "@/features/settings/queries"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  decryptSecret,
  encryptSecret,
  getServerRpcSecret,
  hashServerRpcSecret,
  normalizeGmailAppPassword,
} from "./crypto"
import { sendEmailWithGmailSmtp } from "./mailer"
import { emailSettingsSchema, sendTestEmailSchema, type EmailSettingsPublic } from "./schema"
import { buildTestEmail } from "./templates"

type ExistingRow = {
  gmail_user: string | null
  gmail_app_password_enc: string | null
  sender_name: string | null
  reply_to: string | null
  last_test_at: string | null
  last_test_status: "ok" | "error" | null
  last_test_error: string | null
  updated_at: string | null
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? "").toLowerCase()
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  )
}

/** Saves Gmail SMTP settings from Admin → Settings. App Password is encrypted at rest and never logged. */
export async function saveEmailSettings(
  input: unknown
): Promise<ActionResult<{ settings: EmailSettingsPublic }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = emailSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors)
  }
  const s = parsed.data

  const supabase = await getServerSupabase()
  const { data: existing, error: readErr } = await supabase
    .from("email_settings")
    .select(
      "gmail_user, gmail_app_password_enc, sender_name, reply_to, last_test_at, last_test_status, last_test_error, updated_at"
    )
    .eq("id", true)
    .maybeSingle<ExistingRow>()

  if (readErr) {
    if (isMissingTableError(readErr)) {
      return fail("Email settings database migration (0070) hasn't been pushed yet. Run `npm run db:push` first.")
    }
    return fail("Could not load existing email settings.")
  }

  const nextPasswordEnc = s.gmailAppPassword
    ? encryptSecret(normalizeGmailAppPassword(s.gmailAppPassword))
    : (existing?.gmail_app_password_enc ?? null)

  if (s.enabled && !nextPasswordEnc) {
    return fail("Enter your 16-character Gmail App Password before enabling Gmail SMTP.", {
      gmailAppPassword: ["Enter your 16-character Gmail App Password"],
    })
  }

  const nowIso = new Date().toISOString()
  const serverRpcSecretHash = hashServerRpcSecret(getServerRpcSecret())
  const { error: upsertErr } = await supabase.from("email_settings").upsert(
    {
      id: true,
      enabled: s.enabled,
      gmail_user: s.gmailUser,
      gmail_app_password_enc: nextPasswordEnc,
      server_rpc_secret_hash: serverRpcSecretHash,
      sender_name: s.senderName,
      reply_to: s.replyTo,
      updated_at: nowIso,
      updated_by: auth.user.id,
    },
    { onConflict: "id" }
  )

  if (upsertErr) {
    return fail("Could not save email settings. Please try again.")
  }

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "email_settings.update",
    targetType: "settings",
    targetId: "email_settings",
    metadata: {
      enabled: s.enabled,
      gmailUser: s.gmailUser,
      passwordUpdated: Boolean(s.gmailAppPassword),
    },
  })

  revalidatePath("/admin/settings")
  return {
    ok: true,
    data: {
      settings: {
        enabled: s.enabled,
        gmailUser: s.gmailUser,
        hasAppPassword: Boolean(nextPasswordEnc),
        senderName: s.senderName,
        replyTo: s.replyTo,
        lastTestAt: existing?.last_test_at ?? null,
        lastTestStatus: existing?.last_test_status ?? null,
        lastTestError: existing?.last_test_error ?? null,
        updatedAt: nowIso,
        migrationReady: true,
      },
    },
  }
}

/** Removes the saved Gmail App Password and disables Gmail SMTP. */
export async function clearEmailAppPassword(): Promise<ActionResult<{ settings: EmailSettingsPublic }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const supabase = await getServerSupabase()
  const nowIso = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from("email_settings")
    .update({
      enabled: false,
      gmail_app_password_enc: null,
      last_test_at: null,
      last_test_status: null,
      last_test_error: null,
      updated_at: nowIso,
      updated_by: auth.user.id,
    })
    .eq("id", true)
    .select("gmail_user, sender_name, reply_to")
    .maybeSingle<{ gmail_user: string | null; sender_name: string | null; reply_to: string | null }>()

  if (error) {
    return fail("Could not remove the saved App Password.")
  }

  await logAdminAction(supabase, {
    actorId: auth.user.id,
    action: "email_settings.clear_password",
    targetType: "settings",
    targetId: "email_settings",
  })

  revalidatePath("/admin/settings")
  return {
    ok: true,
    data: {
      settings: {
        enabled: false,
        gmailUser: updated?.gmail_user ?? null,
        hasAppPassword: false,
        senderName: updated?.sender_name ?? null,
        replyTo: updated?.reply_to ?? null,
        lastTestAt: null,
        lastTestStatus: null,
        lastTestError: null,
        updatedAt: nowIso,
        migrationReady: true,
      },
    },
  }
}

/**
 * Sends a live test email via Gmail SMTP using either the currently entered form values
 * or the saved credentials in `email_settings`.
 */
export async function sendTestEmail(
  input: unknown
): Promise<ActionResult<{ testedAt: string; recipientEmail: string }>> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = sendTestEmailSchema.safeParse(input)
  if (!parsed.success) {
    return fail("Enter a valid recipient email address.", z.flattenError(parsed.error).fieldErrors)
  }
  const data = parsed.data

  if (await limited("password-reset", `test-email:${auth.user.id}`)) {
    return fail(RATE_LIMIT_MESSAGE)
  }

  const [supabase, shop] = await Promise.all([getServerSupabase(), getStoreSettings()])
  const { data: existing, error: readErr } = await supabase
    .from("email_settings")
    .select("gmail_user, gmail_app_password_enc, sender_name, reply_to")
    .eq("id", true)
    .maybeSingle<ExistingRow>()

  if (readErr && isMissingTableError(readErr)) {
    return fail("Email settings database migration (0070) hasn't been pushed yet. Run `npm run db:push` first.")
  }

  const gmailUser = data.gmailUser || existing?.gmail_user || null
  const appPassword = data.gmailAppPassword
    ? normalizeGmailAppPassword(data.gmailAppPassword)
    : decryptSecret(existing?.gmail_app_password_enc)

  if (!gmailUser) {
    return fail("Enter your Gmail address first.", { gmailUser: ["Enter your Gmail address"] })
  }
  if (!appPassword) {
    return fail("Enter your 16-character Gmail App Password first.", {
      gmailAppPassword: ["Enter your Gmail App Password"],
    })
  }

  const senderName = data.senderName || existing?.sender_name || shop.shopName
  const replyTo = data.replyTo || existing?.reply_to || shop.email || gmailUser
  const nowIso = new Date().toISOString()
  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(nowIso))

  const emailDoc = buildTestEmail({
    shopName: shop.shopName,
    senderEmail: gmailUser,
    recipientEmail: data.recipientEmail,
    testedAt: `${formattedTime} IST`,
  })

  const sendRes = await sendEmailWithGmailSmtp(
    {
      gmailUser,
      gmailAppPassword: appPassword,
      senderName,
      replyTo,
    },
    {
      to: data.recipientEmail,
      subject: emailDoc.subject,
      html: emailDoc.html,
      text: emailDoc.text,
    }
  )

  await supabase
    .from("email_settings")
    .update({
      last_test_at: nowIso,
      last_test_status: sendRes.ok ? "ok" : "error",
      last_test_error: sendRes.ok ? null : sendRes.error.slice(0, 300),
    })
    .eq("id", true)

  revalidatePath("/admin/settings")

  if (!sendRes.ok) {
    return fail(sendRes.error)
  }

  return {
    ok: true,
    data: { testedAt: nowIso, recipientEmail: data.recipientEmail },
  }
}

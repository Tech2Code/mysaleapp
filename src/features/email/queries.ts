import "server-only"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { DEFAULT_EMAIL_SETTINGS, type EmailSettingsPublic } from "./schema"

type EmailSettingsRow = {
  enabled: boolean | null
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

/**
 * Reads the admin Gmail SMTP settings without ever returning the raw or encrypted App Password.
 * Gracefully degrades if migration 0070 has not been pushed yet.
 */
export async function getEmailSettings(): Promise<EmailSettingsPublic> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("email_settings")
    .select(
      "enabled, gmail_user, gmail_app_password_enc, sender_name, reply_to, last_test_at, last_test_status, last_test_error, updated_at"
    )
    .eq("id", true)
    .maybeSingle<EmailSettingsRow>()

  if (error) {
    if (isMissingTableError(error)) {
      return { ...DEFAULT_EMAIL_SETTINGS, migrationReady: false }
    }
    return { ...DEFAULT_EMAIL_SETTINGS }
  }

  if (!data) return { ...DEFAULT_EMAIL_SETTINGS }

  return {
    enabled: Boolean(data.enabled),
    gmailUser: data.gmail_user,
    hasAppPassword: Boolean(data.gmail_app_password_enc),
    senderName: data.sender_name,
    replyTo: data.reply_to,
    lastTestAt: data.last_test_at,
    lastTestStatus: data.last_test_status,
    lastTestError: data.last_test_error,
    updatedAt: data.updated_at,
    migrationReady: true,
  }
}

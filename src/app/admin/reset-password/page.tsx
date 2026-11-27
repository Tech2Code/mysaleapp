import type { Metadata } from "next"
import { ShieldCheckIcon } from "lucide-react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import styles from "@/components/admin/admin-core.module.css"
import { ResetPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"
import { getCurrentUser, hasValidPasswordResetCookie, isAdminUser } from "@/features/auth/guards"
import { getServerRpcSecret, hashResetToken } from "@/features/email/crypto"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Set a new password" }

/** Reachable through a one-time Gmail SMTP reset token or a verified Supabase recovery session. */
async function Gate({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams
  const rawToken = params.token?.trim() || null

  if (rawToken && isSupabaseConfigured) {
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.rpc("verify_password_reset_token", {
      p_token_hash: hashResetToken(rawToken),
      p_scope: "admin",
      p_server_secret: getServerRpcSecret(),
    })
    const res = (!error && data ? data : null) as { valid?: boolean } | null
    if (!res?.valid) {
      redirect("/admin/forgot-password?error=expired")
    }
    return <ResetPasswordForm resetToken={rawToken} />
  }

  const [cookieStore, user, admin] = await Promise.all([
    cookies(),
    getCurrentUser(),
    isAdminUser(),
  ])
  if (!user) redirect("/admin/forgot-password?error=expired")
  if (!admin) redirect("/admin/login?error=not-admin")
  if (!hasValidPasswordResetCookie(cookieStore.get("kk_pw_reset")?.value, "admin", user.id)) {
    redirect("/admin/forgot-password?error=expired")
  }
  return <ResetPasswordForm />
}

export default function AdminResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  return (
    <main className={styles.authCenteredMain}>
      <div className={cn("adminCard", styles.authCardBox)}>
        <div className={styles.authTopRow}>
          <LogoMark className={styles.logoMark44} />
          <span className={styles.authBadgeSuccess}>
            <ShieldCheckIcon className={styles.icon14} aria-hidden /> Verified Link
          </span>
        </div>
        <h1 className={styles.authTitle}>Choose a new password</h1>
        <p className={styles.authDescription}>You&apos;ll be signed in to your admin workspace right after.</p>
        <Suspense>
          <Gate searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

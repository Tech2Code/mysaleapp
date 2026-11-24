import type { Metadata } from "next"
import { ShieldCheckIcon } from "lucide-react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import styles from "@/components/admin/admin-core.module.css"
import { ResetPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"
import { getCurrentUser, hasValidPasswordResetCookie, isAdminUser } from "@/features/auth/guards"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Set a new password" }

/** Only reachable through the emailed reset link, which signs the admin in first. */
async function Gate() {
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

export default function AdminResetPasswordPage() {
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
          <Gate />
        </Suspense>
      </div>
    </main>
  )
}

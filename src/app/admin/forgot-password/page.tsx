import type { Metadata } from "next"
import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import styles from "@/components/admin/admin-core.module.css"
import { ForgotPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Forgot password" }

export default function AdminForgotPasswordPage() {
  return (
    <main className={styles.authCenteredMain}>
      <div className={cn("adminCard", styles.authCardBox)}>
        <div className={styles.authTopRow}>
          <LogoMark className={styles.logoMark44} />
          <span className={styles.authBadgePrimary}>
            <KeyRoundIcon className={styles.icon14} aria-hidden /> Account Recovery
          </span>
        </div>
        <h1 className={styles.authTitle}>Reset your password</h1>
        <p className={styles.authDescription}>Enter your admin email and we&apos;ll send you a one-time reset link.</p>
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
        <Link href="/admin/login" className={styles.backSignInLink}>
          <ArrowLeftIcon className={styles.icon16} /> Back to sign in
        </Link>
      </div>
    </main>
  )
}

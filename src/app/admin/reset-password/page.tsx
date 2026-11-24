import type { Metadata } from "next"
import { ShieldCheckIcon } from "lucide-react"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ResetPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"
import { getCurrentUser, hasValidPasswordResetCookie, isAdminUser } from "@/features/auth/guards"

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
    <main data-ui="page:/admin/reset-password" className="grid min-h-dvh place-items-center px-4 py-8">
      <div data-ui="page:/admin/reset-password/div" className="adminCard w-full max-w-md rounded-3xl border p-6 sm:p-8">
        <div data-ui="page:/admin/reset-password/div-flex" className="flex items-center justify-between gap-3">
          <LogoMark className="size-11 text-xl" />
          <span data-ui="page:/admin/reset-password/span-inline-flex" className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-semibold text-success">
            <ShieldCheckIcon className="size-3.5" aria-hidden /> Verified Link
          </span>
        </div>
        <h1 data-ui="page:/admin/reset-password/h1-choose-a-new-password" className="mt-6 font-heading text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p data-ui="page:/admin/reset-password/p" className="mt-1.5 mb-6 text-sm text-muted-foreground">You&apos;ll be signed in to your admin workspace right after.</p>
        <Suspense>
          <Gate />
        </Suspense>
      </div>
    </main>
  )
}

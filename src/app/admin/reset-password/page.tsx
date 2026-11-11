import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ResetPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"
import { getCurrentUser, isAdminUser } from "@/features/auth/guards"

export const metadata: Metadata = { title: "Set a new password" }

/** Only reachable through the emailed reset link, which signs the admin in first. */
async function Gate() {
  const cookieStore = await cookies()
  if (cookieStore.get("kk_pw_reset")?.value !== "1") redirect("/admin/forgot-password?error=expired")
  const user = await getCurrentUser()
  if (!user) redirect("/admin/forgot-password?error=expired")
  if (!(await isAdminUser())) redirect("/admin/login?error=not-admin")
  return <ResetPasswordForm />
}

export default function AdminResetPasswordPage() {
  return (
    <main data-ui="page:/admin/reset-password" className="grid min-h-dvh place-items-center bg-hero px-4">
      <div data-ui="page:/admin/reset-password/div" className="w-full max-w-sm rounded-4xl border bg-card p-6 sm:p-8 shadow-2xl shadow-black/5">
        <LogoMark className="size-12 text-2xl" />
        <h1 data-ui="page:/admin/reset-password/h1-choose-a-new-password" className="mt-6 text-2xl font-semibold">Choose a new password</h1>
        <p data-ui="page:/admin/reset-password/p" className="mt-1 mb-6 text-sm text-muted-foreground">You&apos;ll be signed in right after.</p>
        <Suspense>
          <Gate />
        </Suspense>
      </div>
    </main>
  )
}

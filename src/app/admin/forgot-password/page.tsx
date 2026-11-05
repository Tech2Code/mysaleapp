import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { ForgotPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"

export const metadata: Metadata = { title: "Forgot password" }

export default function AdminForgotPasswordPage() {
  return (
    <main data-ui="page:/admin/forgot-password" className="grid min-h-dvh place-items-center bg-hero px-4">
      <div data-ui="page:/admin/forgot-password/div" className="w-full max-w-sm rounded-4xl border bg-card p-6 sm:p-8 shadow-2xl shadow-black/5">
        <LogoMark className="size-12 text-2xl" />
        <h1 data-ui="page:/admin/forgot-password/h1-reset-your-password" className="mt-6 text-2xl font-semibold">Reset your password</h1>
        <p data-ui="page:/admin/forgot-password/p" className="mt-1 mb-6 text-sm text-muted-foreground">Enter your admin email and we&apos;ll send you a link.</p>
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
        <Link data-ui="page:/admin/forgot-password/Link-back-to-sign-in" href="/admin/login" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to sign in
        </Link>
      </div>
    </main>
  )
}

import type { Metadata } from "next"
import { ArrowLeftIcon, KeyRoundIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { ForgotPasswordForm } from "@/components/admin/password-reset-forms"
import { LogoMark } from "@/components/shared/logo"

export const metadata: Metadata = { title: "Forgot password" }

export default function AdminForgotPasswordPage() {
  return (
    <main data-ui="page:/admin/forgot-password" className="grid min-h-dvh place-items-center px-4 py-8">
      <div data-ui="page:/admin/forgot-password/div" className="adminCard w-full max-w-md rounded-3xl border p-6 sm:p-8">
        <div data-ui="page:/admin/forgot-password/div-flex" className="flex items-center justify-between gap-3">
          <LogoMark className="size-11 text-xl" />
          <span data-ui="page:/admin/forgot-password/span-inline-flex" className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <KeyRoundIcon className="size-3.5" aria-hidden /> Account Recovery
          </span>
        </div>
        <h1 data-ui="page:/admin/forgot-password/h1-reset-your-password" className="mt-6 font-heading text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p data-ui="page:/admin/forgot-password/p" className="mt-1.5 mb-6 text-sm text-muted-foreground">Enter your admin email and we&apos;ll send you a one-time reset link.</p>
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
        <Link data-ui="page:/admin/forgot-password/Link-back-to-sign-in" href="/admin/login" className="mt-6 flex items-center justify-center gap-1.5 text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to sign in
        </Link>
      </div>
    </main>
  )
}

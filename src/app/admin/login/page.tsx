import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { LogoMark } from "@/components/shared/logo"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = { title: "Sign in" }

export default function AdminLoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-hero px-4">
      <div className="w-full max-w-sm rounded-[2rem] border bg-card p-8 shadow-2xl shadow-black/5">
        <LogoMark className="size-12 text-2xl" />
        <h1 className="mt-6 text-2xl font-semibold">{siteConfig.name} Admin</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">Manage products and orders.</p>
        <Suspense>
          <AdminLoginForm />
        </Suspense>
        <Link href="/" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to store
        </Link>
      </div>
    </main>
  )
}

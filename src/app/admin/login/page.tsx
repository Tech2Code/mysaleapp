import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { LogoMark } from "@/components/shared/logo"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Sign in" }

export default async function AdminLoginPage() {
  const shop = await getStoreSettings()
  return (
    <main data-ui="page:/admin/login" className="grid min-h-dvh place-items-center bg-hero px-4">
      <div data-ui="page:/admin/login/div" className="w-full max-w-sm rounded-4xl border bg-card p-6 sm:p-8 shadow-2xl shadow-black/5">
        <LogoMark className="size-12 text-2xl" />
        <h1 data-ui="page:/admin/login/h1-admin" className="mt-6 text-2xl font-semibold">{shop.shopName} Admin</h1>
        <p data-ui="page:/admin/login/p" className="mt-1 mb-6 text-sm text-muted-foreground">Manage products and orders.</p>
        <Suspense>
          <AdminLoginForm />
        </Suspense>
        <Link data-ui="page:/admin/login/Link-back-to-store" href="/" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to store
        </Link>
      </div>
    </main>
  )
}

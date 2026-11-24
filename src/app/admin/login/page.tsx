import type { Metadata } from "next"
import { ArrowLeftIcon, BarChart3Icon, PackageCheckIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { LogoMark } from "@/components/shared/logo"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Sign in" }

export default async function AdminLoginPage() {
  const shop = await getStoreSettings()
  return (
    <main data-ui="page:/admin/login" className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div data-ui="page:/admin/login/div-flex" className="flex flex-col justify-between px-4 py-8 sm:px-8 lg:px-12">
        <div data-ui="page:/admin/login/div-flex-2" className="mx-auto flex w-full max-w-md items-center justify-between">
          <div data-ui="page:/admin/login/div-flex-3" className="flex items-center gap-2.5">
            <LogoMark className="size-10 text-xl" />
            <div data-ui="page:/admin/login/div">
              <p data-ui="page:/admin/login/p" className="font-heading text-lg/tight font-semibold">{shop.shopName}</p>
              <p data-ui="page:/admin/login/p-2" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Admin Workspace</p>
            </div>
          </div>
          <Link data-ui="page:/admin/login/Link-storefront" href="/" className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeftIcon className="size-3.5" /> Storefront
          </Link>
        </div>

        <div data-ui="page:/admin/login/div-2" className="m-auto w-full max-w-md py-8">
          <div data-ui="page:/admin/login/div-3" className="adminCard rounded-3xl border p-6 sm:p-8">
            <span data-ui="page:/admin/login/span-inline-flex" className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <ShieldCheckIcon className="size-3.5" aria-hidden /> Secure Admin Access
            </span>
            <h1 data-ui="page:/admin/login/h1-welcome-back" className="mt-4 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back
            </h1>
            <p data-ui="page:/admin/login/p-3" className="mt-1.5 mb-6 text-sm text-muted-foreground">
              Sign in to manage {shop.shopName} orders, catalogue, payments, and store settings.
            </p>
            <Suspense>
              <AdminLoginForm />
            </Suspense>
          </div>
        </div>

        <p data-ui="page:/admin/login/p-4" className="mx-auto w-full max-w-md text-center text-xs text-muted-foreground lg:text-left">
          Protected by role-based access control &amp; 4-digit Quick PIN lock.
        </p>
      </div>

      <aside data-ui="page:/admin/login/aside-hidden" className="adminAuthShowcase hidden border-l p-12 lg:flex lg:flex-col lg:justify-center">
        <div data-ui="page:/admin/login/div-4" className="mx-auto w-full max-w-lg space-y-6">
          <div data-ui="page:/admin/login/div-5" className="space-y-2">
            <p data-ui="page:/admin/login/p-5" className="text-xs font-semibold tracking-widest text-primary uppercase">Operations Hub</p>
            <h2 data-ui="page:/admin/login/h2-everything-your-store-" className="font-heading text-3xl font-semibold tracking-tight text-foreground">
              Everything your store needs, in one calm workspace.
            </h2>
            <p data-ui="page:/admin/login/p-6" className="text-sm/relaxed text-muted-foreground">
              Built for fast daily operations — from verifying UPI payments and packing orders to keeping stock and storefront settings up to date.
            </p>
          </div>
          <div data-ui="page:/admin/login/div-grid" className="grid gap-3">
            <div data-ui="page:/admin/login/div-flex-4" className="adminCard flex items-start gap-3.5 rounded-2xl border p-4">
              <span data-ui="page:/admin/login/span-grid" className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-300">
                <PackageCheckIcon className="size-5" aria-hidden />
              </span>
              <div data-ui="page:/admin/login/div-6">
                <p data-ui="page:/admin/login/p-7" className="text-sm font-semibold">Order &amp; Payment Verification</p>
                <p data-ui="page:/admin/login/p-8" className="mt-0.5 text-xs text-muted-foreground">Review UTRs, update fulfilment stages, manage returns, and print invoices.</p>
              </div>
            </div>
            <div data-ui="page:/admin/login/div-flex-5" className="adminCard flex items-start gap-3.5 rounded-2xl border p-4">
              <span data-ui="page:/admin/login/span-grid-2" className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                <BarChart3Icon className="size-5" aria-hidden />
              </span>
              <div data-ui="page:/admin/login/div-7">
                <p data-ui="page:/admin/login/p-9" className="text-sm font-semibold">Live Revenue &amp; Inventory Insights</p>
                <p data-ui="page:/admin/login/p-10" className="mt-0.5 text-xs text-muted-foreground">Track financial-year revenue, top sellers, and low-stock alerts in real time.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}

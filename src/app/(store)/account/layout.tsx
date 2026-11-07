import type { Metadata } from "next"
import { Suspense } from "react"
import { AccountNav } from "@/components/account/account-nav"
import { requireUser } from "@/features/auth/guards"

export const metadata: Metadata = { title: "My account", robots: { index: false } }

/** Server-side guard (the proxy redirect is only a shortcut). Reads cookies, so it has its own Suspense boundary. */
async function AccountGuard() {
  await requireUser("/account")
  return null
}

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div data-ui="layout:/account" className="container-page grid grid-cols-1 gap-8 pt-10 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside data-ui="layout:/account/aside" className="lg:sticky-store lg:self-start">
        <h1 data-ui="layout:/account/h1-my-account" className="mb-4 sr-only text-2xl font-semibold lg:not-sr-only">My account</h1>
        <AccountNav />
      </aside>
      <div data-ui="layout:/account/div" className="min-w-0">{children}</div>
      <Suspense fallback={null}>
        <AccountGuard />
      </Suspense>
    </div>
  )
}

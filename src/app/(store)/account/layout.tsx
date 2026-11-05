import type { Metadata } from "next"
import { AccountNav } from "@/components/account/account-nav"

export const metadata: Metadata = { title: "My account", robots: { index: false } }

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div data-ui="layout:/account" className="container-page grid gap-8 pt-10 lg:grid-cols-[240px_1fr]">
      <aside data-ui="layout:/account/aside" className="lg:sticky-store lg:self-start">
        <h1 data-ui="layout:/account/h1-my-account" className="mb-4 hidden text-2xl font-semibold lg:block">My account</h1>
        <AccountNav />
      </aside>
      <div data-ui="layout:/account/div" className="min-w-0">{children}</div>
    </div>
  )
}

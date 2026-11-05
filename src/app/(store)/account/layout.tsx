import type { Metadata } from "next"
import { AccountNav } from "@/components/account/account-nav"

export const metadata: Metadata = { title: "My account", robots: { index: false } }

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="container-page grid gap-8 pt-10 lg:grid-cols-[240px_1fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <h1 className="mb-4 hidden text-2xl font-semibold lg:block">My account</h1>
        <AccountNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

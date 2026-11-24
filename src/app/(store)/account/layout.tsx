import type { Metadata } from "next"
import { Suspense } from "react"
import { AccountNav } from "@/components/account/account-nav"
import { requireUser } from "@/features/auth/guards"
import { cn } from "@/lib/utils"
import styles from "@/components/account/account.module.css"

export const metadata: Metadata = { title: "My account", robots: { index: false } }

/** Server-side guard (the proxy redirect is only a shortcut). Reads cookies, so it has its own Suspense boundary. */
async function AccountGuard() {
  await requireUser("/account")
  return null
}

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className={cn("container-page", styles.accountLayoutGrid)}>
      <aside className={styles.accountSidebar}>
        <h1 className={styles.accountMainHeading}>My account</h1>
        <AccountNav />
      </aside>
      <div className={styles.accountContentCol}>{children}</div>
      <Suspense fallback={null}>
        <AccountGuard />
      </Suspense>
    </div>
  )
}

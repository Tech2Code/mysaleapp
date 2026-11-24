import { WifiOffIcon } from "lucide-react"
import type { Metadata } from "next"
import { getStoreSettings } from "@/features/settings/queries"
import { cn } from "@/lib/utils"
import styles from "@/app/(store)/store-layout.module.css"

export const metadata: Metadata = { title: "You're offline", robots: { index: false } }

/** Shown by the service worker when there's no connection. Kept dependency-free. */
export default async function OfflinePage() {
  const shop = await getStoreSettings()
  return (
    <main className={cn(styles.fullCenterHeroMain, "bg-hero")}>
      <div>
        <div className={styles.offlineCircle}>
          <WifiOffIcon className={styles.wifiIcon} />
        </div>
        <h1 className={styles.statusPageTitle}>You&apos;re offline</h1>
        <p className={styles.statusPageLeadNarrow}>
          Check your internet connection. Pages you&apos;ve visited on {shop.shopName} are still available.
        </p>
        {/* Plain <a> on purpose: a full page load is what retries the network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={styles.offlineTryLink}>
          Try again
        </a>
      </div>
    </main>
  )
}

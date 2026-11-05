import { WifiOffIcon } from "lucide-react"
import type { Metadata } from "next"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "You're offline", robots: { index: false } }

/** Shown by the service worker when there's no connection. Kept dependency-free. */
export default async function OfflinePage() {
  const shop = await getStoreSettings()
  return (
    <main data-ui="page:/offline" className="grid min-h-dvh place-items-center bg-hero px-4 text-center">
      <div>
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-secondary">
          <WifiOffIcon className="size-9 text-primary" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">
          Check your internet connection. Pages you&apos;ve visited on {shop.shopName} are still available.
        </p>
        {/* Plain <a> on purpose: a full page load is what retries the network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground">
          Try again
        </a>
      </div>
    </main>
  )
}

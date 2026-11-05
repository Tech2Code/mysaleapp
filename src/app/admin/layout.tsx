import type { Metadata } from "next"
import { getStoreSettings } from "@/features/settings/queries"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return {
    title: { default: "Admin", template: `%s · Admin · ${shop.shopName}` },
    robots: { index: false, follow: false },
  }
}

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div data-ui="layout:/admin" className="min-h-dvh bg-muted/40">{children}</div>
}

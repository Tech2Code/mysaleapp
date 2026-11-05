import type { Metadata } from "next"
import { siteConfig } from "@/config/site"

export const metadata: Metadata = {
  title: { default: "Admin", template: `%s · Admin · ${siteConfig.name}` },
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div className="min-h-dvh bg-muted/40">{children}</div>
}

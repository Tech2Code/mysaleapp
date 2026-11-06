import type { Metadata, Viewport } from "next"
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google"
import { Providers } from "@/components/shared/providers"
import { StoreSettingsProvider } from "@/components/store/store-settings-provider"
import { siteConfig } from "@/config/site"
import { getStoreSettings } from "@/features/settings/queries"
import "./globals.css"

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["SOFT", "opsz"],
})

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
})

/** Site-wide metadata comes from Admin → Settings (shop name, tagline, description, keywords). */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings()
  const title = `${s.shopName} — ${s.tagline}`
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: title, template: `%s | ${s.shopName}` },
    description: s.description,
    keywords: s.keywords,
    applicationName: s.shopName,
    authors: [{ name: s.shopName }],
    creator: s.shopName,
    formatDetection: { telephone: false },
    // No site-wide canonical: it would be inherited by every page. Pages set their own via pageMetadata().
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: s.shopName,
      title,
      description: s.description,
    },
    twitter: { card: "summary_large_image", title, description: s.description },
    appleWebApp: { capable: true, title: s.shopName.slice(0, 12), statusBarStyle: "default" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    // Paste the code from Google Search Console → Settings → Ownership verification
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a17" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings()

  return (
    <html data-ui="layout:/" lang="en-IN" suppressHydrationWarning data-scroll-behavior="smooth" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <StoreSettingsProvider value={settings}>
          <Providers>{children}</Providers>
        </StoreSettingsProvider>
      </body>
    </html>
  )
}

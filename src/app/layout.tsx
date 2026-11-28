import type { Metadata, Viewport } from "next"
import { Outfit, Plus_Jakarta_Sans } from "next/font/google"
import { Providers } from "@/components/shared/providers"
import { StoreSettingsProvider } from "@/components/store/store-settings-provider"
import { siteConfig } from "@/config/site"
import { getStoreSettings } from "@/features/settings/queries"
import { buildCustomThemeCss, resolveThemeBrandPalette } from "@/features/settings/theme"
import "./globals.css"
import styles from "@/app/(store)/store-layout.module.css"

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
})

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
})

/** Site-wide metadata comes from Admin → Settings (shop name, tagline, description, keywords). */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getStoreSettings()
  const brand = resolveThemeBrandPalette(s.themePreset, s.themeCustom)
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
    icons: {
      icon: [{ url: `/icon?v=${brand.versionKey}`, type: "image/png" }],
      apple: [{ url: `/apple-icon?v=${brand.versionKey}`, type: "image/png" }],
    },
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

export async function generateViewport(): Promise<Viewport> {
  const s = await getStoreSettings()
  const brand = resolveThemeBrandPalette(s.themePreset, s.themeCustom)
  return {
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: brand.themeColor },
      { media: "(prefers-color-scheme: dark)", color: "#0B0F17" },
    ],
    width: "device-width",
    initialScale: 1,
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings()
  const customThemeCss =
    settings.themePreset === "custom" && settings.themeCustom
      ? buildCustomThemeCss(settings.themeCustom)
      : null

  return (
    <html
      lang="en-IN"
      data-theme={settings.themePreset}
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${styles.rootHtml}`}
    >
      <body suppressHydrationWarning className={styles.rootBody}>
        {customThemeCss && (
          <style id="kalakriti-custom-theme" dangerouslySetInnerHTML={{ __html: customThemeCss }} />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=location.pathname;if(/^\\/products\\/[^/]+$/.test(p)||p==="/checkout")document.body.setAttribute("data-product-detail","true");else document.body.removeAttribute("data-product-detail")}catch(e){}`,
          }}
        />
        <StoreSettingsProvider value={settings}>
          <Providers>{children}</Providers>
        </StoreSettingsProvider>
      </body>
    </html>
  )
}

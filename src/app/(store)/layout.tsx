import { CookieBanner } from "@/components/shared/cookie-banner"
import { JsonLd } from "@/components/shared/json-ld"
import { AnnouncementBar } from "@/components/store/announcement-bar"
import { CartDrawer } from "@/components/store/cart-drawer"
import { Footer } from "@/components/store/footer"
import { Header } from "@/components/store/header"
import { InstallPrompt } from "@/components/store/install-prompt"
import { MobileBottomNav } from "@/components/store/mobile-bottom-nav"
import { WhatsAppFab } from "@/components/store/whatsapp-fab"
import { getCategoriesWithCounts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { organizationJsonLd } from "@/lib/seo"
import styles from "./store-layout.module.css"

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [categories, settings] = await Promise.all([getCategoriesWithCounts(), getStoreSettings()])
  const nav = categories.map(({ name, slug }) => ({ name, slug }))

  return (
    <>
      <a
        href="#main"
        className={styles.skipLink}
      >
        Skip to content
      </a>
      <AnnouncementBar text={settings.announcement} />
      <Header categories={nav} />
      <main id="main" className={styles.storeMain}>
        {children}
      </main>
      <Footer categories={nav} shop={settings} />
      <MobileBottomNav />
      <CartDrawer />
      <WhatsAppFab />
      <InstallPrompt />
      <CookieBanner />
      <JsonLd data={organizationJsonLd(settings)} />
    </>
  )
}

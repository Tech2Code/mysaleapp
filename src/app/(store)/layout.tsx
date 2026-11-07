import { Suspense } from "react"
import { JsonLd } from "@/components/shared/json-ld"
import { ScrollReset } from "@/components/shared/scroll-reset"
import { AnnouncementBar } from "@/components/store/announcement-bar"
import { CartDrawer } from "@/components/store/cart-drawer"
import { Footer } from "@/components/store/footer"
import { Header } from "@/components/store/header"
import { InstallPrompt } from "@/components/store/install-prompt"
import { WhatsAppFab } from "@/components/store/whatsapp-fab"
import { getCategoriesWithCounts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { organizationJsonLd } from "@/lib/seo"

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const [categories, settings] = await Promise.all([getCategoriesWithCounts(), getStoreSettings()])
  const nav = categories.map(({ name, slug }) => ({ name, slug }))

  return (
    <>
      <a data-ui="layout://a-skip-to-content"
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Suspense fallback={null}>
        <ScrollReset />
      </Suspense>
      <AnnouncementBar text={settings.announcement} />
      <Header categories={nav} />
      <main data-ui="layout://main-main" id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={nav} shop={settings} />
      <CartDrawer />
      <WhatsAppFab />
      <InstallPrompt />
      <JsonLd data={organizationJsonLd(settings)} />
    </>
  )
}

import { JsonLd } from "@/components/shared/json-ld"
import { CartDrawer } from "@/components/store/cart-drawer"
import { Footer } from "@/components/store/footer"
import { Header } from "@/components/store/header"
import { WhatsAppFab } from "@/components/store/whatsapp-fab"
import { getCategoriesWithCounts } from "@/features/products/queries"
import { organizationJsonLd } from "@/lib/seo"

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const categories = await getCategoriesWithCounts()
  const nav = categories.map(({ name, slug }) => ({ name, slug }))

  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header categories={nav} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={nav} />
      <CartDrawer />
      <WhatsAppFab />
      <JsonLd data={organizationJsonLd()} />
    </>
  )
}

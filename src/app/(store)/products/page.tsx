import type { Metadata } from "next"
import { Suspense } from "react"
import { JsonLd } from "@/components/shared/json-ld"
import { PageHeader } from "@/components/store/page-header"
import { ProductBrowser } from "@/components/store/product-browser"
import { ProductGrid } from "@/components/store/product-grid"
import { getActiveProducts, getCategoriesWithCounts } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Shop all handmade gifts & decor",
    description: `Browse every handmade product at ${shop.shopName} — home decor, candles, wall art, jewellery and gifts. Pay securely by UPI.`,
    path: "/products",
  })
}

export default async function ProductsPage() {
  const [products, categories, shop] = await Promise.all([getActiveProducts(), getCategoriesWithCounts(), getStoreSettings()])

  return (
    <>
      <PageHeader
        title="Shop all"
        description="Every piece is made by hand in small batches — no two are exactly alike."
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop all" }]}
      />
      <div className="container-page pt-8">
        {/* Fallback is the full, crawlable grid; filters hydrate on top of it. */}
        <Suspense fallback={<ProductGrid products={products} />}>
          <ProductBrowser products={products} categories={categories} />
        </Suspense>
      </div>
      <JsonLd
        data={[
          itemListJsonLd(products, shop),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Shop all", path: "/products" },
          ]),
        ]}
      />
    </>
  )
}

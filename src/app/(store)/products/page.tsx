import type { Metadata } from "next"
import { JsonLd } from "@/components/shared/json-ld"
import { ProductsPageView } from "@/components/store/page-views"
import { getActiveProducts, getCategoriesWithCounts, getProductListItems } from "@/features/products/queries"
import { getStoreSettings } from "@/features/settings/queries"
import { breadcrumbJsonLd, itemListJsonLd, pageMetadata } from "@/lib/seo"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return pageMetadata(shop, {
    title: "Shop all products",
    description: `Browse every product at ${shop.shopName}. ${shop.tagline}. Pay securely by UPI.`,
    path: "/products",
  })
}

export default async function ProductsPage() {
  const [products, items, categories, shop] = await Promise.all([getActiveProducts(), getProductListItems(), getCategoriesWithCounts(), getStoreSettings()])

  return (
    <>
      <ProductsPageView items={items} categories={categories} />
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

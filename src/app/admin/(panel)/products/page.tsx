import type { Metadata } from "next"
import { ProductsView } from "@/components/admin/products-view"
import { listAllProducts, listStockAlerts } from "@/features/products/admin-queries"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Products" }

export default async function AdminProductsPage() {
  const [products, stockAlerts, settings] = await Promise.all([
    listAllProducts(),
    listStockAlerts(),
    getStoreSettings(),
  ])
  return <ProductsView products={products} stockAlerts={stockAlerts} shopName={settings.shopName} />
}

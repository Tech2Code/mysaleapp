import type { Metadata } from "next"
import { ProductsView } from "@/components/admin/products-view"
import { listAllProducts } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Products" }

export default async function AdminProductsPage() {
  return <ProductsView products={await listAllProducts()} />
}

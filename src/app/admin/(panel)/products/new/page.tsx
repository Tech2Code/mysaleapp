import type { Metadata } from "next"
import { ProductFormView } from "@/components/admin/page-views"
import { listAllCategories } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Add product" }

export default async function NewProductPage() {
  return <ProductFormView product={null} categories={await listAllCategories()} />
}

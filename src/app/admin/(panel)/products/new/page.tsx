import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductForm } from "@/components/admin/product-form"
import { listAllCategories } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Add product" }

export default async function NewProductPage() {
  const categories = await listAllCategories()
  return (
    <>
      <AdminPageHeader title="Add product" description="Fill in the details and hit create — it goes live instantly." />
      <ProductForm product={null} categories={categories} />
    </>
  )
}

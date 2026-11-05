import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { CategoryManager } from "@/components/admin/category-manager"
import { listAllCategories } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Categories" }

export default async function AdminCategoriesPage() {
  const categories = await listAllCategories()
  return (
    <>
      <AdminPageHeader title="Categories" description="Organise products into collections." />
      <CategoryManager categories={categories} />
    </>
  )
}

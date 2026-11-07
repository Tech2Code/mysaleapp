import type { Metadata } from "next"
import { CategoriesView } from "@/components/admin/page-views"
import { listAllCategories } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Categories" }

export default async function AdminCategoriesPage() {
  return <CategoriesView categories={await listAllCategories()} />
}

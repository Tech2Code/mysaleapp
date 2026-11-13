import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { connection } from "next/server"
import { ProductFormView } from "@/components/admin/page-views"
import { getProductForEdit, listAllCategories } from "@/features/products/admin-queries"

export const metadata: Metadata = { title: "Edit product" }

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await connection()
  const { id } = await params
  const [product, categories] = await Promise.all([getProductForEdit(id), listAllCategories()])
  if (!product) notFound()

  return <ProductFormView product={product} categories={categories} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ProductFormView } from "@/components/admin/page-views"
import { getProductForEdit, listAllCategories } from "@/features/products/admin-queries"
import Loading from "./loading"

export const metadata: Metadata = { title: "Edit product" }

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <EditProductDetails params={params} />
    </Suspense>
  )
}

async function EditProductDetails({ params }: Pick<PageProps<"/admin/products/[id]">, "params">) {
  const { id } = await params
  const [product, categories] = await Promise.all([getProductForEdit(id), listAllCategories()])
  if (!product) notFound()

  return <ProductFormView product={product} categories={categories} />
}

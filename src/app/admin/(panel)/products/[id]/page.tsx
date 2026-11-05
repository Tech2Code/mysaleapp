import { ExternalLinkIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductForm } from "@/components/admin/product-form"
import { buttonVariants } from "@/components/ui/button"
import { getProductForEdit, listAllCategories } from "@/features/products/admin-queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Edit product" }

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const { id } = await params
  const [product, categories] = await Promise.all([getProductForEdit(id), listAllCategories()])
  if (!product) notFound()

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description="Changes go live on the store as soon as you save."
        actions={
          product.isActive && (
            <Link data-ui="page:/admin/products/[id]/Link-view-in-store"
              href={`/products/${product.slug}`}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline" }), "rounded-full")}
            >
              <ExternalLinkIcon /> View in store
            </Link>
          )
        }
      />
      <ProductForm product={product} categories={categories} />
    </>
  )
}

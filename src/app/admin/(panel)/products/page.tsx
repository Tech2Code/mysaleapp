import { PlusIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductFlagSwitch, ProductRowActions } from "@/components/admin/product-row-actions"
import { ProductImage } from "@/components/store/product-image"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAllProducts } from "@/features/products/admin-queries"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Products" }

export default async function AdminProductsPage() {
  const products = await listAllProducts()

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${products.length} product${products.length === 1 ? "" : "s"} · ${products.filter((p) => p.isActive).length} visible in store`}
        actions={
          <Link data-ui="page:/admin/products/Link-add-product" href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-4")}>
            <PlusIcon /> Add product
          </Link>
        }
      />

      <div data-ui="page:/admin/products/div" className="overflow-hidden rounded-2xl border bg-card">
        {products.length === 0 ? (
          <div data-ui="page:/admin/products/div-2" className="p-8 sm:p-12 text-center">
            <p data-ui="page:/admin/products/p" className="font-medium">No products yet</p>
            <p data-ui="page:/admin/products/p-2" className="mt-1 text-sm text-muted-foreground">Add your first product to start selling.</p>
          </div>
        ) : (
          <Table data-ui="page:/admin/products/Table">
            <TableHeader data-ui="page:/admin/products/TableHeader">
              <TableRow data-ui="page:/admin/products/TableRow">
                <TableHead data-ui="page:/admin/products/TableHead-product" className="pl-5">Product</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead-category" className="hidden md:table-cell">Category</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead-price" className="text-right">Price</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead-stock" className="hidden text-right sm:table-cell">Stock</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead-active" className="text-center">Active</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead-featured" className="hidden text-center sm:table-cell">Featured</TableHead>
                <TableHead data-ui="page:/admin/products/TableHead" className="pr-5 text-right">
                  <span data-ui="page:/admin/products/span" className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-ui="page:/admin/products/TableBody">
              {products.map((p) => (
                <TableRow data-ui="page:/admin/products/TableRow-2" key={p.id}>
                  <TableCell data-ui="page:/admin/products/TableCell" className="pl-5">
                    <Link data-ui="page:/admin/products/Link-flex" href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span data-ui="page:/admin/products/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.images[0]} alt={p.name} sizes="44px" />
                      </span>
                      <span data-ui="page:/admin/products/span-2" className="max-w-56 truncate font-medium hover:text-primary">{p.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-hidden" className="hidden text-sm text-muted-foreground md:table-cell">{p.category?.name ?? "—"}</TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-2" className="text-right font-medium">{formatPrice(p.price)}</TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-3" className={cn("hidden text-right sm:table-cell", p.stock === 0 && "font-semibold text-destructive")}>
                    {p.stock === 0 ? "Sold out" : p.stock}
                  </TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-4" className="text-center">
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                  </TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-hidden-2" className="hidden text-center sm:table-cell">
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                  </TableCell>
                  <TableCell data-ui="page:/admin/products/TableCell-5" className="pr-5">
                    <ProductRowActions productId={p.id} name={p.name} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  )
}

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
          <Link href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-4")}>
            <PlusIcon /> Add product
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border bg-card">
        {products.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-medium">No products yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first product to start selling.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Product</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Stock</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="hidden text-center sm:table-cell">Featured</TableHead>
                <TableHead className="pr-5 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-5">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.images[0]} alt={p.name} sizes="44px" />
                      </span>
                      <span className="max-w-56 truncate font-medium hover:text-primary">{p.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{p.category?.name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{formatPrice(p.price)}</TableCell>
                  <TableCell className={cn("hidden text-right sm:table-cell", p.stock === 0 && "font-semibold text-destructive")}>
                    {p.stock === 0 ? "Sold out" : p.stock}
                  </TableCell>
                  <TableCell className="text-center">
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                  </TableCell>
                  <TableCell className="hidden text-center sm:table-cell">
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                  </TableCell>
                  <TableCell className="pr-5">
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

import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductFlagSwitch, ProductRowActions } from "@/components/admin/product-row-actions"
import { ProductImage } from "@/components/store/product-image"
import { buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"

/** The admin products page. The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function ProductsView({ products }: { products: Product[] }) {
  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${products.length} product${products.length === 1 ? "" : "s"} · ${products.filter((p) => p.isActive).length} visible in store`}
        actions={
          <Link data-ui="admin/ProductsView/Link-add-product" href="/admin/products/new" className={cn(buttonVariants(), "rounded-full px-4")}>
            <PlusIcon /> Add product
          </Link>
        }
      />

      <div data-ui="admin/ProductsView/div" className="overflow-hidden rounded-2xl border bg-card">
        {products.length === 0 ? (
          <div data-ui="admin/ProductsView/div-2" className="p-8 sm:p-12 text-center">
            <p data-ui="admin/ProductsView/p" className="font-medium">No products yet</p>
            <p data-ui="admin/ProductsView/p-2" className="mt-1 text-sm text-muted-foreground">Add your first product to start selling.</p>
          </div>
        ) : (
          <Table data-ui="admin/ProductsView/Table">
            <TableHeader data-ui="admin/ProductsView/TableHeader">
              <TableRow data-ui="admin/ProductsView/TableRow">
                <TableHead data-ui="admin/ProductsView/TableHead-product" className="pl-5">Product</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead-category" className="hidden md:table-cell">Category</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead-price" className="text-right">Price</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead-stock" className="hidden text-right sm:table-cell">Stock</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead-active" className="text-center">Active</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead-featured" className="hidden text-center sm:table-cell">Featured</TableHead>
                <TableHead data-ui="admin/ProductsView/TableHead" className="pr-5 text-right">
                  <span data-ui="admin/ProductsView/span" className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-ui="admin/ProductsView/TableBody">
              {products.map((p) => (
                <TableRow data-ui="admin/ProductsView/TableRow-2" key={p.id}>
                  <TableCell data-ui="admin/ProductsView/TableCell" className="pl-5">
                    <Link data-ui="admin/ProductsView/Link-flex" href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span data-ui="admin/ProductsView/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.images[0]} alt={p.name} sizes="44px" />
                      </span>
                      <span data-ui="admin/ProductsView/span-2" className="max-w-56 truncate font-medium hover:text-primary">{p.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-hidden" className="hidden text-sm text-muted-foreground md:table-cell">{p.category?.name ?? "—"}</TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-2" className="text-right font-medium">{formatPrice(p.price)}</TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-3" className={cn("hidden text-right sm:table-cell", p.stock === 0 && "font-semibold text-destructive")}>
                    {p.stock === 0 ? "Sold out" : p.stock}
                  </TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-4" className="text-center">
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                  </TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-hidden-2" className="hidden text-center sm:table-cell">
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                  </TableCell>
                  <TableCell data-ui="admin/ProductsView/TableCell-5" className="pr-5">
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

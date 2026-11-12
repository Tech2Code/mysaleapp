"use client"

import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
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
  const [viewMode, setViewMode] = useState<"tiles" | "table">("table")

  useEffect(() => {
    try {
      localStorage.removeItem("admin_products_view")
    } catch {}

    const mql = window.matchMedia("(max-width: 767px)")
    const syncView = () => {
      const isMobile = mql.matches
      const key = isMobile ? "admin_products_view_mobile" : "admin_products_view_desktop"
      try {
        const saved = localStorage.getItem(key)
        if (saved === "table" || saved === "tiles") {
          setViewMode(saved)
          return
        }
      } catch {}
      // Default: mobile = tiles, web = list (table)
      setViewMode(isMobile ? "tiles" : "table")
    }

    syncView()
    mql.addEventListener("change", syncView)
    return () => mql.removeEventListener("change", syncView)
  }, [])

  const changeView = (mode: "tiles" | "table") => {
    setViewMode(mode)
    try {
      const isMobile = window.matchMedia("(max-width: 767px)").matches
      const key = isMobile ? "admin_products_view_mobile" : "admin_products_view_desktop"
      localStorage.setItem(key, mode)
    } catch {}
  }

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${products.length} product${products.length === 1 ? "" : "s"} · ${products.filter((p) => p.isActive).length} visible in store`}
        actions={
          <div data-ui="admin/ProductsView/div-flex" className="flex items-center gap-2">
            <div data-ui="admin/ProductsView/div-view-format" className="flex items-center rounded-full border bg-muted/40 p-1 text-xs font-medium" role="group" aria-label="View format">
              <button data-ui="admin/ProductsView/button-list-view"
                type="button"
                onClick={() => changeView("table")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer",
                  viewMode === "table" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "table"}
                aria-label="List view"
              >
                <ListIcon className="size-3.5" />
                <span data-ui="admin/ProductsView/span">List</span>
              </button>
              <button data-ui="admin/ProductsView/button-tile-view"
                type="button"
                onClick={() => changeView("tiles")}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors cursor-pointer",
                  viewMode === "tiles" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={viewMode === "tiles"}
                aria-label="Tile view"
              >
                <LayoutGridIcon className="size-3.5" />
                <span data-ui="admin/ProductsView/span-2">Tiles</span>
              </button>
            </div>
            <Link data-ui="admin/ProductsView/Link-add-product" href="/admin/products/new" prefetch={true} className={cn(buttonVariants(), "rounded-full px-4")}>
              <PlusIcon /> Add product
            </Link>
          </div>
        }
      />

      {products.length === 0 ? (
        <div data-ui="admin/ProductsView/div" className="overflow-hidden rounded-2xl border bg-card p-8 text-center sm:p-12">
          <p data-ui="admin/ProductsView/p" className="font-medium">No products yet</p>
          <p data-ui="admin/ProductsView/p-2" className="mt-1 text-sm text-muted-foreground">Add your first product to start selling.</p>
        </div>
      ) : viewMode === "tiles" ? (
        <div data-ui="admin/ProductsView/div-grid" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <div
              key={p.id}
              data-ui="admin/ProductsView/div-flex-2"
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-ring/40 hover:shadow-md"
            >
              <div data-ui="admin/ProductsView/div-2" className="space-y-3">
                <div data-ui="admin/ProductsView/div-relative" className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted @container">
                  <ProductImage src={p.images[0]} alt={p.name} sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
                  <div data-ui="admin/ProductsView/div-flex-3" className="absolute top-2 right-2 flex items-center gap-1">
                    <span data-ui="admin/ProductsView/span-3"
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-xs backdrop-blur-xs",
                        p.stock === 0 ? "bg-destructive text-destructive-foreground" : p.stock <= 5 ? "bg-amber-500 text-white" : "bg-background/90 text-foreground"
                      )}
                    >
                      {p.stock === 0 ? "Sold out" : `${p.stock} in stock`}
                    </span>
                  </div>
                </div>

                <div data-ui="admin/ProductsView/div-3" className="space-y-1">
                  <div data-ui="admin/ProductsView/div-flex-4" className="flex items-center justify-between gap-2">
                    <span data-ui="admin/ProductsView/span-4" className="truncate text-xs font-medium text-muted-foreground">{p.category?.name ?? "Uncategorized"}</span>
                    <span data-ui="admin/ProductsView/span-5" className="font-semibold text-base text-foreground">{formatPrice(p.price)}</span>
                  </div>
                  <Link data-ui="admin/ProductsView/Link"
                    href={`/admin/products/${p.id}`}
                    prefetch={true}
                    className="block text-sm font-medium leading-snug text-foreground transition-colors line-clamp-2 hover:text-primary"
                  >
                    {p.name}
                  </Link>
                </div>
              </div>

              <div data-ui="admin/ProductsView/div-flex-5" className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
                <div data-ui="admin/ProductsView/div-flex-6" className="flex items-center gap-3">
                  <div data-ui="admin/ProductsView/div-flex-7" className="flex items-center gap-1.5" title="Store visibility">
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                    <span data-ui="admin/ProductsView/span-6" className="text-[11px] font-medium text-muted-foreground">Active</span>
                  </div>
                  <div data-ui="admin/ProductsView/div-flex-8" className="flex items-center gap-1.5" title="Home page feature">
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                    <span data-ui="admin/ProductsView/span-7" className="text-[11px] font-medium text-muted-foreground">Featured</span>
                  </div>
                </div>
                <ProductRowActions productId={p.id} name={p.name} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div data-ui="admin/ProductsView/div-4" className="overflow-hidden rounded-2xl border bg-card">
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
                  <span data-ui="admin/ProductsView/span-8" className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody data-ui="admin/ProductsView/TableBody">
              {products.map((p) => (
                <TableRow data-ui="admin/ProductsView/TableRow-2" key={p.id}>
                  <TableCell data-ui="admin/ProductsView/TableCell" className="pl-5">
                    <Link data-ui="admin/ProductsView/Link-flex" href={`/admin/products/${p.id}`} prefetch={true} className="flex items-center gap-3">
                      <span data-ui="admin/ProductsView/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={p.images[0]} alt={p.name} sizes="44px" />
                      </span>
                      <span data-ui="admin/ProductsView/span-9" className="max-w-56 truncate font-medium hover:text-primary">{p.name}</span>
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
        </div>
      )}
    </>
  )
}

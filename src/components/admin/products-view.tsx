"use client"

import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductFlagSwitch, ProductRowActions } from "@/components/admin/product-row-actions"
import { SearchField } from "@/components/form"
import { ProductImage } from "@/components/store/product-image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./admin-views.module.css"

type StockFilter = "all" | "active" | "hidden" | "featured" | "low-stock" | "sold-out"

/** The admin products page. The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function ProductsView({ products }: { products: Product[] }) {
  const [viewMode, setViewMode] = useState<"tiles" | "table">("table")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StockFilter>("all")

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

  const filterChips = useMemo(
    () =>
      [
        { id: "all", label: "All", count: products.length },
        { id: "active", label: "Active", count: products.filter((p) => p.isActive).length },
        { id: "hidden", label: "Hidden", count: products.filter((p) => !p.isActive).length },
        { id: "featured", label: "Featured", count: products.filter((p) => p.isFeatured).length },
        { id: "low-stock", label: "Low stock (≤5)", count: products.filter((p) => p.stock > 0 && p.stock <= 5).length },
        { id: "sold-out", label: "Sold out", count: products.filter((p) => p.stock === 0).length },
      ] as const,
    [products]
  )

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filter === "active" && !p.isActive) return false
      if (filter === "hidden" && p.isActive) return false
      if (filter === "featured" && !p.isFeatured) return false
      if (filter === "low-stock" && !(p.stock > 0 && p.stock <= 5)) return false
      if (filter === "sold-out" && p.stock !== 0) return false
      if (q) {
        const hay = `${p.name} ${p.slug} ${p.category?.name ?? ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [products, filter, search])

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Products"
        description={`${products.length} product${products.length === 1 ? "" : "s"} · ${products.filter((p) => p.isActive).length} visible in store`}
        actions={
          <div className={styles.headerActions}>
            <div className={styles.viewSwitcher} role="group" aria-label="View format">
              <button
                type="button"
                onClick={() => changeView("table")}
                className={cn(styles.viewBtn, viewMode === "table" && styles.viewBtnActive)}
                aria-pressed={viewMode === "table"}
                aria-label="List view"
              >
                <ListIcon className={styles.iconSm} />
                <span>List</span>
              </button>
              <button
                type="button"
                onClick={() => changeView("tiles")}
                className={cn(styles.viewBtn, viewMode === "tiles" && styles.viewBtnActive)}
                aria-pressed={viewMode === "tiles"}
                aria-label="Tile view"
              >
                <LayoutGridIcon className={styles.iconSm} />
                <span>Tiles</span>
              </button>
            </div>
            <Link href="/admin/products/new" prefetch={true} className={cn(buttonVariants({ size: "sm" }), styles.addProductBtn)}>
              <PlusIcon className={styles.iconSm} /> Add product
            </Link>
          </div>
        }
      />

      {products.length > 0 && (
        <div className={cn("adminCard", styles.filterBar)}>
          <div className={cn("scroll-row", styles.chipRow)} role="group" aria-label="Filter products">
            {filterChips.map((chip) => {
              const active = filter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(chip.id)}
                  className={cn(styles.filterChip, active && styles.filterChipActive)}
                >
                  <span>{chip.label}</span>
                  <span
                    className={cn(styles.chipCount, active && styles.chipCountActive)}
                  >
                    {chip.count}
                  </span>
                </button>
              )
            })}
          </div>
          <div className={styles.searchWrap}>
            <SearchField
              label="Search products"
              fieldSize="md"
              placeholder="Search products or category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={search ? () => setSearch("") : undefined}
            />
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No products yet</p>
          <p className={styles.emptySubtitle}>Add your first product to start selling.</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No products match your search or filter</p>
          <p className={styles.emptySubtitle}>Try clearing the search query or switching to All products.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFilter("all")
              setSearch("")
            }}
            className={styles.showAllBtn}
          >
            Show all products
          </Button>
        </div>
      ) : viewMode === "tiles" ? (
        <div className={styles.tilesGrid}>
          {filteredProducts.map((p) => (
            <div
              key={p.id}

              className={cn("adminCardInteractive", styles.productTile)}
            >
              <div className={styles.tileBody}>
                <div className={styles.tileImageWrap}>
                  <ProductImage src={p.images[0]} alt={p.name} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
                  <div className={styles.stockBadgeWrap}>
                    <span
                      className={cn(
                        styles.stockBadge,
                        p.stock === 0 ? styles.stockBadgeOut : p.stock <= 5 ? styles.stockBadgeLow : styles.stockBadgeNormal
                      )}
                    >
                      {p.stock === 0 ? "Sold out" : `${p.stock} in stock`}
                    </span>
                  </div>
                </div>

                <div className={styles.tileMeta}>
                  <div className={styles.tileMetaHeader}>
                    <span className={styles.tileCategory}>{p.category?.name ?? "Uncategorized"}</span>
                    <span className={styles.tilePrice}>{formatPrice(p.price)}</span>
                  </div>
                  <Link
                    href={`/admin/products/${encodeURIComponent(p.slug)}`}
                    className={styles.tileTitleLink}
                  >
                    {p.name}
                  </Link>
                </div>
              </div>

              <div className={styles.tileFooter}>
                <div className={styles.tileSwitches}>
                  <div className={styles.switchItem} title="Store visibility">
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                    <span className={styles.switchLabel}>Active</span>
                  </div>
                  <div className={styles.switchItem} title="Home page feature">
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                    <span className={styles.switchLabel}>Featured</span>
                  </div>
                </div>
                <ProductRowActions productId={p.id} productSlug={p.slug} name={p.name} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div

          tabIndex={0}
          role="region"
          aria-label="Products table"
          className={cn("adminCard", styles.tableCard)}
        >
          <Table>
            <TableHeader className={styles.tableHeaderSticky}>
              <TableRow>
                <TableHead className={styles.cellPl}>Product</TableHead>
                <TableHead className={styles.cellHiddenMd}>Category</TableHead>
                <TableHead className={styles.cellRight}>Price</TableHead>
                <TableHead className={styles.cellHiddenSmRight}>Stock</TableHead>
                <TableHead className={styles.cellCenter}>Active</TableHead>
                <TableHead className={styles.cellHiddenSmCenter}>Featured</TableHead>
                <TableHead className={styles.cellPrRight}>
                  <span className={styles.srOnly}>Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className={styles.cellPl}>
                    <Link href={`/admin/products/${encodeURIComponent(p.slug)}`} className={styles.productCellLink}>
                      <span className={styles.productThumb}>
                        <ProductImage src={p.images[0]} alt={p.name} sizes="44px" />
                      </span>
                      <span className={styles.productName}>{p.name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className={styles.cellCategory}>{p.category?.name ?? "—"}</TableCell>
                  <TableCell className={styles.cellPrice}>{formatPrice(p.price)}</TableCell>
                  <TableCell className={cn(styles.cellHiddenSmRight, p.stock === 0 && styles.cellStockOut)}>
                    {p.stock === 0 ? "Sold out" : p.stock}
                  </TableCell>
                  <TableCell className={styles.cellCenter}>
                    <ProductFlagSwitch productId={p.id} flag="isActive" value={p.isActive} label={`Show ${p.name} in store`} />
                  </TableCell>
                  <TableCell className={styles.cellHiddenSmCenter}>
                    <ProductFlagSwitch productId={p.id} flag="isFeatured" value={p.isFeatured} label={`Feature ${p.name} on home page`} />
                  </TableCell>
                  <TableCell className={styles.cellPr}>
                    <ProductRowActions productId={p.id} productSlug={p.slug} name={p.name} />
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

"use client"

import { BellRingIcon, CheckIcon, LayoutGridIcon, ListIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { ProductFlagSwitch, ProductRowActions } from "@/components/admin/product-row-actions"
import { SearchField } from "@/components/form"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { ProductImage } from "@/components/store/product-image"
import { PillTabs } from "@/components/shared/pill-tabs"
import { SegmentedTabs } from "@/components/shared/segmented-tabs"
import { Button, buttonVariants } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { siteConfig } from "@/config/site"
import { whatsappLink } from "@/features/orders/whatsapp"
import { deleteStockAlert, markStockAlertNotified } from "@/features/products/actions"
import type { Product, StockAlert } from "@/features/products/types"
import { formatDate, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./admin-views.module.css"

type StockFilter = "all" | "active" | "hidden" | "featured" | "low-stock" | "sold-out"

const EMPTY_STOCK_ALERTS: StockAlert[] = []

/** The admin products page. The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function ProductsView({
  products,
  stockAlerts = EMPTY_STOCK_ALERTS,
  shopName = "our store",
}: {
  products: Product[]
  stockAlerts?: StockAlert[]
  shopName?: string
}) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"tiles" | "table">("table")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StockFilter>("all")
  const [alerts, setAlerts] = useState<StockAlert[]>(stockAlerts)
  const [prevStockAlerts, setPrevStockAlerts] = useState<StockAlert[]>(stockAlerts)
  if (stockAlerts !== prevStockAlerts) {
    setPrevStockAlerts(stockAlerts)
    setAlerts(stockAlerts)
  }
  const [busyAlertId, setBusyAlertId] = useState<string | null>(null)
  const [, startAlertTransition] = useTransition()

  const waitingAlerts = useMemo(() => alerts.filter((a) => a.status === "waiting"), [alerts])
  const readyToNotify = useMemo(() => waitingAlerts.filter((a) => a.productStock > 0), [waitingAlerts])
  const waitingByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of waitingAlerts) map.set(a.productId, (map.get(a.productId) ?? 0) + 1)
    return map
  }, [waitingAlerts])

  const handleMarkNotified = (alertId: string) => {
    setBusyAlertId(alertId)
    startAlertTransition(async () => {
      const res = await markStockAlertNotified(alertId)
      setBusyAlertId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, status: "notified" } : a)))
      toast.success("Marked as notified")
      router.refresh()
    })
  }

  const handleDeleteAlert = (alertId: string) => {
    setBusyAlertId(alertId)
    startAlertTransition(async () => {
      const res = await deleteStockAlert(alertId)
      setBusyAlertId(null)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setAlerts((prev) => prev.filter((a) => a.id !== alertId))
      toast.success("Alert removed")
      router.refresh()
    })
  }

  const buildRestockWaHref = (a: StockAlert) => {
    const greeting = a.customerName.trim() ? `Hi ${a.customerName.trim()}!` : "Hi!"
    const itemTitle = a.variantLabel ? `${a.productName} (${a.variantLabel})` : a.productName
    const productUrl = a.productSlug ? ` ${siteConfig.url}/products/${a.productSlug}` : ""
    const msg = `${greeting} Good news from ${shopName} — "${itemTitle}" is back in stock! Order yours before it sells out:${productUrl}`
    return whatsappLink(`91${a.phone}`, msg)
  }

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
            <SegmentedTabs
              layout="inline"
              size="sm"
              ariaLabel="View format"
              value={viewMode}
              onChange={changeView}
              items={[
                { value: "table", label: "List", icon: ListIcon, ariaLabel: "List view" },
                { value: "tiles", label: "Tiles", icon: LayoutGridIcon, ariaLabel: "Tile view" },
              ]}
            />
            <Link href="/admin/products/new" prefetch={true} className={cn(buttonVariants({ size: "sm" }), styles.addProductBtn)}>
              <PlusIcon className={styles.iconSm} /> Add product
            </Link>
          </div>
        }
      />

      {waitingAlerts.length > 0 && (
        <section aria-label="Back in stock customer alerts" className={cn("adminCard", styles.restockAlertsCard)}>
          <div className={styles.restockAlertsHeader}>
            <div className={styles.restockAlertsTitleRow}>
              <BellRingIcon className={styles.restockBellIcon} aria-hidden />
              <h2 className={styles.restockAlertsHeading}>Back-in-stock alerts</h2>
              {readyToNotify.length > 0 && (
                <span className={styles.readyNotifyBadge}>
                  {readyToNotify.length} ready to notify
                </span>
              )}
              <span className={styles.waitingCountPill}>{waitingAlerts.length} waiting</span>
            </div>
            <p className={styles.restockAlertsDesc}>
              Customers who asked for a WhatsApp alert when sold-out items return. Restocked items appear first.
            </p>
          </div>
          <ul className={styles.restockAlertsList}>
            {[...readyToNotify, ...waitingAlerts.filter((a) => a.productStock <= 0)].map((a) => {
              const isReady = a.productStock > 0
              const isBusy = busyAlertId === a.id
              return (
                <li key={a.id} className={cn(styles.restockAlertRow, isReady && styles.restockAlertRowReady)}>
                  <div className={styles.restockAlertLeft}>
                    <Link href={`/admin/products/${encodeURIComponent(a.productSlug)}`} className={styles.restockAlertThumb}>
                      <ProductImage src={a.productImage} alt={a.productName} sizes="44px" />
                    </Link>
                    <div className={styles.restockAlertInfo}>
                      <div className={styles.restockAlertProductLine}>
                        <Link href={`/admin/products/${encodeURIComponent(a.productSlug)}`} className={styles.restockAlertProductName}>
                          {a.productName}
                        </Link>
                        {a.variantLabel && (
                          <span className={styles.waitingCountPill}>{a.variantLabel}</span>
                        )}
                        <span className={cn(styles.restockStockPill, isReady ? styles.restockStockIn : styles.restockStockOut)}>
                          {isReady ? `${a.productStock} in stock` : "Sold out"}
                        </span>
                      </div>
                      <p className={styles.restockCustomerLine}>
                        <span className={styles.restockCustomerName}>{a.customerName || "Customer"}</span> · +91 {a.phone} · Requested {formatDate(a.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.restockAlertActions}>
                    {isReady && (
                      <a
                        href={buildRestockWaHref(a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "whatsapp", size: "sm" })}
                      >
                        <WhatsAppIcon className={styles.iconSm} /> Notify on WhatsApp
                      </a>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => handleMarkNotified(a.id)}
                      className={styles.restockMarkBtn}
                    >
                      <CheckIcon className={styles.iconSm} /> Done
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      disabled={isBusy}
                      aria-label={`Dismiss alert for ${a.customerName || a.phone}`}
                      onClick={() => handleDeleteAlert(a.id)}
                      className={styles.restockDeleteBtn}
                    >
                      <Trash2Icon className={styles.iconSm} />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {products.length > 0 && (
        <div className={cn("adminCard", styles.filterBar)}>
          <PillTabs
            role="group"
            size="sm"
            ariaLabel="Filter products"
            value={filter}
            onChange={setFilter}
            items={filterChips.map((chip) => ({
              value: chip.id,
              label: chip.label,
              count: chip.count,
            }))}
          />
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
                    {(waitingByProduct.get(p.id) ?? 0) > 0 && (
                      <span className={styles.waitingAlertBadge} title={`${waitingByProduct.get(p.id)} waiting for restock`}>
                        <BellRingIcon className={styles.iconXs} aria-hidden /> {waitingByProduct.get(p.id)}
                      </span>
                    )}
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

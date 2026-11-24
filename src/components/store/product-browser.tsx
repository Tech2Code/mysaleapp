"use client"

import * as m from "motion/react-m"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { SearchField, SelectField } from "@/components/form"
import { Pagination } from "@/components/shared/pagination"
import { parseSearchQuery, priceDistanceToQuery, scoreProductSearch, type Category, type ProductListItem } from "@/features/products/types"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import styles from "./product-browser.module.css"
import { ProductCard } from "./product-card"

export const PRODUCTS_PER_PAGE = 12

const SORTS = {
  featured: "Featured",
  new: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const
type SortKey = keyof typeof SORTS

function isSortKey(v: string | null): v is SortKey {
  return v !== null && v in SORTS
}

function sortFrom(params: { get(name: string): string | null }): SortKey {
  const v = params.get("sort")
  return isSortKey(v) ? v : "featured"
}

function pageFrom(params: { get(name: string): string | null }): number {
  const raw = Number.parseInt(params.get("page") ?? "1", 10)
  return Number.isFinite(raw) && raw > 1 ? raw : 1
}

/** One comparable string for a filter + page state. */
function filterKey(q: string, category: string, sort: SortKey, page: number): string {
  return JSON.stringify([q, category, sort, page])
}

/** Client-side search / filter / sort / pagination. The catalogue is small, so this is instant. */
export function ProductBrowser({
  products,
  categories,
}: {
  products: ProductListItem[]
  categories: Pick<Category, "id" | "name" | "slug">[]
}) {
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get("q") ?? "")
  const [category, setCategory] = useState(params.get("category") ?? "all")
  const [sort, setSort] = useState<SortKey>(sortFrom(params))
  const [page, setPage] = useState<number>(pageFrom(params))

  // The URL stays shareable without a server round-trip (debounced: Safari rate-limits replaceState).
  // `synced` is the last filter state the URL is known to carry (read from it or written to it), so a change
  // that comes from OUTSIDE (a link to /products?sort=…, back/forward) can be told apart from our own writes.
  const pathname = usePathname()
  const synced = useRef(filterKey(query, category, sort, page))
  const pending = useRef<{ q: string; category: string; sort: SortKey; page: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // URL -> state, only when the URL was changed by something other than us.
  const paramsKey = filterKey(params.get("q") ?? "", params.get("category") ?? "all", sortFrom(params), pageFrom(params))
  useEffect(() => {
    if (paramsKey === synced.current) return
    synced.current = paramsKey
    const next = JSON.parse(paramsKey) as [string, string, SortKey, number]
    // An outside navigation replaces whatever was still waiting to be written.
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    setQuery(next[0])
    setCategory(next[1])
    setSort(next[2])
    setPage(next[3])
  }, [paramsKey])

  // state -> URL. Unrelated params (utm_* …) are kept, and nothing is written when it would be a no-op.
  const writeUrl = useCallback(() => {
    const f = pending.current
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    if (!f) return
    const sp = new URLSearchParams(window.location.search)
    for (const k of ["q", "category", "sort", "page"]) sp.delete(k)
    if (f.q) sp.set("q", f.q)
    if (f.category !== "all") sp.set("category", f.category)
    if (f.sort !== "featured") sp.set("sort", f.sort)
    if (f.page > 1) sp.set("page", String(f.page))
    synced.current = filterKey(f.q, f.category, f.sort, f.page)
    const qs = sp.toString()
    if (qs === window.location.search.slice(1)) return
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
  }, [])

  // The input updates at once; the (animated) list catches up when React has time.
  const deferredQuery = useDeferredValue(query)

  const visible = useMemo(() => {
    const q = deferredQuery.trim()
    const parsed = q ? parseSearchQuery(q) : null
    const scored = products
      .map((p) => {
        if (category !== "all" && p.category?.slug !== category) return null
        if (!parsed) return { p, score: Number(p.isFeatured) }
        const score = scoreProductSearch(p, parsed)
        if (score === null) return null
        return { p, score }
      })
      .filter((x): x is { p: ProductListItem; score: number } => x !== null)

    const inStockFirst = (a: { p: ProductListItem }, b: { p: ProductListItem }) =>
      Number(b.p.stock > 0) - Number(a.p.stock > 0)
    switch (sort) {
      case "new":
        return scored.sort((a, b) => inStockFirst(a, b) || b.p.createdAt.localeCompare(a.p.createdAt)).map((x) => x.p)
      case "price-asc":
        return scored.sort((a, b) => inStockFirst(a, b) || a.p.price - b.p.price).map((x) => x.p)
      case "price-desc":
        return scored.sort((a, b) => inStockFirst(a, b) || b.p.price - a.p.price).map((x) => x.p)
      default:
        return scored
          .sort((a, b) => inStockFirst(a, b) || b.score - a.score || Number(b.p.isFeatured) - Number(a.p.isFeatured))
          .map((x) => x.p)
    }
  }, [products, deferredQuery, category, sort])

  const totalPages = Math.max(1, Math.ceil(visible.length / PRODUCTS_PER_PAGE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const paginatedProducts = useMemo(
    () => visible.slice((currentPage - 1) * PRODUCTS_PER_PAGE, currentPage * PRODUCTS_PER_PAGE),
    [visible, currentPage]
  )

  useEffect(() => {
    if (filterKey(query, category, sort, currentPage) === synced.current) {
      pending.current = null
      return
    }
    pending.current = { q: query, category, sort, page: currentPage }
    timer.current = setTimeout(writeUrl, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, category, sort, currentPage, writeUrl])

  // Leaving the page inside the debounce window must not lose the filter in history. Only write while we are
  // still on this page: once the router has pushed the next URL, replacing it would corrupt it.
  const mountedPathRef = useRef(pathname)
  useEffect(
    () => () => {
      if (pending.current && window.location.pathname === mountedPathRef.current) writeUrl()
    },
    [writeUrl]
  )

  const chips = [{ slug: "all", name: "All" }, ...categories]

  // Picking a filter or changing page repositions the results cleanly right under the sticky bar.
  const barRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [isStuck, setIsStuck] = useState(false)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    const checkStuck = () => {
      const stickyTop = parseFloat(getComputedStyle(bar).top) || 64
      const rect = bar.getBoundingClientRect()
      const nextStuck = window.scrollY > 8 && rect.top <= stickyTop + 1
      setIsStuck((prev) => (prev === nextStuck ? prev : nextStuck))
    }
    checkStuck()
    window.addEventListener("scroll", checkStuck, { passive: true })
    window.addEventListener("resize", checkStuck, { passive: true })
    return () => {
      window.removeEventListener("scroll", checkStuck)
      window.removeEventListener("resize", checkStuck)
    }
  }, [])

  const lastStateRef = useRef({ filters: `${deferredQuery}|${category}|${sort}`, page: currentPage })
  useLayoutEffect(() => {
    const filters = `${deferredQuery}|${category}|${sort}`
    const prev = lastStateRef.current
    if (prev.filters === filters && prev.page === currentPage) return
    const pageChanged = prev.page !== currentPage && prev.filters === filters
    lastStateRef.current = { filters, page: currentPage }
    const bar = barRef.current
    const list = listRef.current
    if (!bar || !list) return

    const sticky = getComputedStyle(bar).position === "sticky"
    const top = parseFloat(getComputedStyle(bar).top) || 0
    const limit = sticky ? top + bar.offsetHeight : top
    const gap = list.getBoundingClientRect().top - limit - 12
    if (pageChanged) {
      if (Math.abs(gap) > 8) window.scrollBy({ top: gap, behavior: "smooth" })
    } else if (gap < 0) {
      window.scrollBy({ top: gap, behavior: "instant" })
    }
  }, [deferredQuery, category, sort, currentPage])

  return (
    <div>
      <div ref={barRef} className={cn(styles.stickyFilterBar, isStuck && styles.stickyFilterBarStuck)}>
        <div className={styles.controlsRow}>
          <SearchField
            label="Search products"
            pill
            maxLength={LIMITS.search.max}
            containerClassName={styles.searchGrow}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            onClear={() => {
              setQuery("")
              setPage(1)
            }}
            placeholder="Search candles, vases, gifts…"
          />
          <SelectField
            label="Sort products"
            hideLabel
            pill
            containerClassName={styles.sortSelectWidth}
            value={sort}
            onValueChange={(next) => {
              setSort(next as SortKey)
              setPage(1)
            }}
            options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
          />
        </div>

        <div className={styles.chipsRow} role="group" aria-label="Filter by category">
          {chips.map((c) => {
            const active = category === c.slug
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setCategory(c.slug)
                  setPage(1)
                }}
                className={cn(styles.categoryChip, active && styles.categoryChipActive)}
              >
                {active && (
                  <m.span
                    layoutId="chip-active"
                    className={styles.activeChipBg}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className={styles.chipLabel}>{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div ref={listRef}>
        <p className={styles.resultsCountText} aria-live="polite">
          {visible.length} {visible.length === 1 ? "product" : "products"}
          {totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ""}
        </p>

        {visible.length === 0 ? (
          <div className={styles.noMatchStack}>
            <div className={styles.noMatchBanner}>
              <p className={styles.noMatchTitle}>
                No exact matches for “{deferredQuery.trim() || category}” — showing popular picks you might like
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  setCategory("all")
                  setPage(1)
                }}
                className={styles.clearFiltersBtn}
              >
                Clear filters &amp; show all products
              </button>
            </div>
            <div className={styles.browserGrid}>
              {(() => {
                const q = deferredQuery.trim()
                const parsed = q ? parseSearchQuery(q) : null
                const relaxedParsed = parsed ? { ...parsed, minPrice: null, maxPrice: null } : null
                return products.toSorted((a, b) => {
                    const stockDiff = Number(b.stock > 0) - Number(a.stock > 0)
                    if (stockDiff !== 0) return stockDiff
                    if (parsed && relaxedParsed) {
                      const aScore = scoreProductSearch(a, relaxedParsed) ?? 0
                      const bScore = scoreProductSearch(b, relaxedParsed) ?? 0
                      if (bScore !== aScore) return bScore - aScore
                      const distDiff = priceDistanceToQuery(a.price, parsed) - priceDistanceToQuery(b.price, parsed)
                      if (distDiff !== 0) return distDiff
                    }
                    return Number(b.isFeatured) - Number(a.isFeatured)
                  })
                  .slice(0, PRODUCTS_PER_PAGE)
                  .map((p, i) => (
                    <div key={p.id}>
                      <ProductCard product={p} priority={i < 4} />
                    </div>
                  ))
              })()}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.browserGrid}>
              {paginatedProducts.map((p, i) => (
                <div key={p.id}>
                  <ProductCard product={p} priority={i < 4} />
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                totalItems={visible.length}
                pageSize={PRODUCTS_PER_PAGE}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

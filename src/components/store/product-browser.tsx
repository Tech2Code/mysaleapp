"use client"

import { SearchXIcon } from "lucide-react"
import { AnimatePresence, LazyMotion } from "motion/react"
import * as m from "motion/react-m"
import { useSearchParams } from "next/navigation"
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { SearchField, SelectField } from "@/components/form"
import type { Category, ProductListItem } from "@/features/products/types"
import { cn } from "@/lib/utils"
import { ProductCard } from "./product-card"

// Layout animations (layout / layoutId) need the bigger feature set; load it only for this page.
const loadLayoutFeatures = () => import("@/components/shared/motion-features-max").then((mod) => mod.default)

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

/** Client-side search / filter / sort. The catalogue is small, so this is instant. */
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
  const [sort, setSort] = useState<SortKey>(isSortKey(params.get("sort")) ? (params.get("sort") as SortKey) : "featured")

  // Keep the URL shareable without a server round-trip. Debounced: Safari rate-limits replaceState.
  const urlReady = useRef(false)
  useEffect(() => {
    if (!urlReady.current) {
      urlReady.current = true
      return
    }
    const t = setTimeout(() => {
      const sp = new URLSearchParams()
      if (query) sp.set("q", query)
      if (category !== "all") sp.set("category", category)
      if (sort !== "featured") sp.set("sort", sort)
      const qs = sp.toString()
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
    }, 300)
    return () => clearTimeout(t)
  }, [query, category, sort])

  // The input updates at once; the (animated) list catches up when React has time.
  const deferredQuery = useDeferredValue(query)

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const list = products.filter(
      (p) =>
        (category === "all" || p.category?.slug === category) &&
        (!q || p.searchText.includes(q))
    )
    switch (sort) {
      case "new":
        return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      case "price-asc":
        return [...list].sort((a, b) => a.price - b.price)
      case "price-desc":
        return [...list].sort((a, b) => b.price - a.price)
      default:
        return [...list].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
    }
  }, [products, deferredQuery, category, sort])

  const chips = [{ slug: "all", name: "All" }, ...categories]

  // Picking a filter shortens the page. If the reader had scrolled down, the browser clamps them to the very
  // bottom (footer). Put the start of the results back right under the sticky bar instead.
  const barRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const firstRun = useRef(true)
  useLayoutEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const bar = barRef.current
    const list = listRef.current
    if (!bar || !list) return
    const gap = list.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - 12
    if (gap < 0) window.scrollBy({ top: gap, behavior: "instant" })
  }, [deferredQuery, category, sort])

  return (
    <LazyMotion features={loadLayoutFeatures}>
    <div data-ui="store/ProductBrowser/div">
      <div ref={barRef} data-ui="store/ProductBrowser/div-2" className="sticky-store-flush z-20 -mx-4 mb-8 space-y-3 px-4 py-3 glass sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div data-ui="store/ProductBrowser/div-flex" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchField
            label="Search products"
            pill
            containerClassName="flex-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search candles, vases, gifts…"
          />
          <SelectField
            label="Sort products"
            hideLabel
            pill
            containerClassName="sm:w-56"
            value={sort}
            onValueChange={(next) => {
              setSort(next as SortKey)
            }}
            options={Object.entries(SORTS).map(([value, label]) => ({ value, label }))}
          />
        </div>

        <div data-ui="store/ProductBrowser/div-filter-by-category" className="scroll-row flex gap-2 sm:flex-wrap" role="group" aria-label="Filter by category">
          {chips.map((c) => {
            const active = category === c.slug
            return (
              <button data-ui="store/ProductBrowser/button"
                key={c.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.slug)}
                className={cn(
                  "relative shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active ? "border-transparent text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                {active && (
                  <m.span data-ui="store/ProductBrowser/m.span-absolute"
                    layoutId="chip-active"
                    className="absolute inset-0 z-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span data-ui="store/ProductBrowser/span-relative" className="relative">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div ref={listRef} data-ui="store/ProductBrowser/div-3" className="min-h-[70svh]">
      <p data-ui="store/ProductBrowser/p" className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {visible.length} {visible.length === 1 ? "product" : "products"}
      </p>

      {visible.length === 0 ? (
        <div data-ui="store/ProductBrowser/div-flex-2" className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-14 sm:py-20 text-center">
          <SearchXIcon className="size-10 text-muted-foreground" />
          <p data-ui="store/ProductBrowser/p-2" className="font-heading text-xl">No matches found</p>
          <p data-ui="store/ProductBrowser/p-3" className="text-sm text-muted-foreground">Try a different word or category.</p>
        </div>
      ) : (
        <m.div data-ui="store/ProductBrowser/m.div-grid" layout className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visible.map((p, i) => (
              <m.div data-ui="store/ProductBrowser/m.div"
                key={p.id}
                layout
                initial={{ scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <ProductCard product={p} priority={i < 4} />
              </m.div>
            ))}
          </AnimatePresence>
        </m.div>
      )}
      </div>
    </div>
    </LazyMotion>
  )
}

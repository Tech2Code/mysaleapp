"use client"

import { SearchXIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { usePathname, useSearchParams } from "next/navigation"
import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { SearchField, SelectField } from "@/components/form"
import type { Category, ProductListItem } from "@/features/products/types"
import { cn } from "@/lib/utils"
import { ProductCard } from "./product-card"

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

/** One comparable string for a filter state. */
function filterKey(q: string, category: string, sort: SortKey): string {
  return JSON.stringify([q, category, sort])
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
  const [sort, setSort] = useState<SortKey>(sortFrom(params))

  // The URL stays shareable without a server round-trip (debounced: Safari rate-limits replaceState).
  // `synced` is the last filter state the URL is known to carry (read from it or written to it), so a change
  // that comes from OUTSIDE (a link to /products?sort=…, back/forward) can be told apart from our own writes.
  const pathname = usePathname()
  const synced = useRef(filterKey(query, category, sort))
  const pending = useRef<{ q: string; category: string; sort: SortKey } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // URL -> state, only when the URL was changed by something other than us.
  const paramsKey = filterKey(params.get("q") ?? "", params.get("category") ?? "all", sortFrom(params))
  useEffect(() => {
    if (paramsKey === synced.current) return
    synced.current = paramsKey
    const next = JSON.parse(paramsKey) as [string, string, SortKey]
    // An outside navigation replaces whatever was still waiting to be written.
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    setQuery(next[0])
    setCategory(next[1])
    setSort(next[2])
  }, [paramsKey])

  // state -> URL. Unrelated params (utm_* …) are kept, and nothing is written when it would be a no-op.
  const writeUrl = useCallback(() => {
    const f = pending.current
    pending.current = null
    if (timer.current) clearTimeout(timer.current)
    if (!f) return
    const sp = new URLSearchParams(window.location.search)
    for (const k of ["q", "category", "sort"]) sp.delete(k)
    if (f.q) sp.set("q", f.q)
    if (f.category !== "all") sp.set("category", f.category)
    if (f.sort !== "featured") sp.set("sort", f.sort)
    synced.current = filterKey(f.q, f.category, f.sort)
    const qs = sp.toString()
    if (qs === window.location.search.slice(1)) return
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`)
  }, [])

  useEffect(() => {
    if (filterKey(query, category, sort) === synced.current) {
      pending.current = null
      return
    }
    pending.current = { q: query, category, sort }
    timer.current = setTimeout(writeUrl, 300)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [query, category, sort, writeUrl])

  // Leaving the page inside the debounce window must not lose the filter in history. Only write while we are
  // still on this page: once the router has pushed the next URL, replacing it would corrupt it.
  const path = useRef(pathname)
  useEffect(() => {
    path.current = pathname
  }, [pathname])
  useEffect(
    () => () => {
      if (pending.current && window.location.pathname === path.current) writeUrl()
    },
    [writeUrl]
  )

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
  // Run only when the filters REALLY changed. A "first run" flag is not enough: React Strict Mode and Next's
  // hidden-page cache (Cache Components keeps old pages mounted and re-runs their effects when they are shown
  // again) run this effect again with nothing changed, which scrolled the page to a random spot on arrival.
  const lastFilters = useRef(`${deferredQuery}|${category}|${sort}`)
  useLayoutEffect(() => {
    const filters = `${deferredQuery}|${category}|${sort}`
    if (lastFilters.current === filters) return
    lastFilters.current = filters
    const bar = barRef.current
    const list = listRef.current
    if (!bar || !list) return

    // Where the list may start: under the sticky bar (phones) or under the sticky store header (bar is static).
    const align = () => {
      const sticky = getComputedStyle(bar).position === "sticky"
      // Where the bar sits when stuck (not where it is now: at the page bottom it has scrolled away with its parent).
      const top = parseFloat(getComputedStyle(bar).top) || 0
      const limit = sticky ? top + bar.offsetHeight : top
      const gap = list.getBoundingClientRect().top - limit - 12
      if (gap < 0) window.scrollBy({ top: gap, behavior: "instant" })
    }
    align()

    // The page keeps changing height after this commit: leaving cards stay in the flow until their exit
    // animation ends, then the page shrinks and the browser clamps the scroll position. Re-align on every
    // height change for a short while, and stop as soon as the reader scrolls themselves.
    let last = performance.now()
    const bump = () => {
      last = performance.now()
      align()
    }
    const ro = new ResizeObserver(bump)
    ro.observe(document.body) // not <html>: it is h-full, so its size never follows the content height
    ro.observe(list)
    // Stop once the height has been stable for 300 ms (hard cap 2.5 s) or as soon as the reader scrolls.
    const started = last
    const poll = setInterval(() => {
      const now = performance.now()
      if (now - last > 300 || now - started > 2500) stop()
    }, 100)
    const stop = () => {
      ro.disconnect()
      clearInterval(poll)
      window.removeEventListener("wheel", stop)
      window.removeEventListener("touchmove", stop)
      window.removeEventListener("keydown", stop)
    }
    window.addEventListener("wheel", stop, { passive: true })
    window.addEventListener("touchmove", stop, { passive: true })
    window.addEventListener("keydown", stop)
    return stop
  }, [deferredQuery, category, sort])

  return (
    <div data-ui="store/ProductBrowser">
      <div ref={barRef} data-ui="store/ProductBrowser/div" className="sticky-store-flush z-20 -mx-4 mb-8 space-y-3 px-4 py-3 glass sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
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

      <div ref={listRef} data-ui="store/ProductBrowser/div-2" className="min-h-[70svh]">
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
  )
}

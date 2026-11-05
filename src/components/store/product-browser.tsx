"use client"

import { SearchIcon, SearchXIcon, XIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import type { Category, Product } from "@/features/products/types"
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

/** Client-side search / filter / sort. The catalogue is small, so this is instant. */
export function ProductBrowser({
  products,
  categories,
}: {
  products: Product[]
  categories: Pick<Category, "id" | "name" | "slug">[]
}) {
  const params = useSearchParams()
  const [query, setQuery] = useState(params.get("q") ?? "")
  const [category, setCategory] = useState(params.get("category") ?? "all")
  const [sort, setSort] = useState<SortKey>(isSortKey(params.get("sort")) ? (params.get("sort") as SortKey) : "featured")

  // Keep the URL shareable without triggering a server round-trip.
  const syncUrl = (next: { q?: string; category?: string; sort?: SortKey }) => {
    const sp = new URLSearchParams()
    const q = next.q ?? query
    const c = next.category ?? category
    const s = next.sort ?? sort
    if (q) sp.set("q", q)
    if (c !== "all") sp.set("category", c)
    if (s !== "featured") sp.set("sort", s)
    const qs = sp.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = products.filter(
      (p) =>
        (category === "all" || p.category?.slug === category) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category?.name.toLowerCase().includes(q))
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
  }, [products, query, category, sort])

  const chips = [{ slug: "all", name: "All" }, ...categories]

  return (
    <div>
      <div className="sticky top-16 z-20 -mx-4 mb-8 space-y-3 px-4 py-3 glass sm:static sm:mx-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search products</span>
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                syncUrl({ q: e.target.value })
              }}
              placeholder="Search candles, vases, gifts…"
              className="h-12 w-full rounded-full border bg-card pr-10 pl-11 text-sm shadow-sm transition-shadow outline-none focus:ring-3 focus:ring-ring/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("")
                  syncUrl({ q: "" })
                }}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                const s = e.target.value as SortKey
                setSort(s)
                syncUrl({ sort: s })
              }}
              className="h-12 rounded-full border bg-card px-4 text-sm font-medium shadow-sm outline-none focus:ring-3 focus:ring-ring/30"
            >
              {Object.entries(SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by category">
          {chips.map((c) => {
            const active = category === c.slug
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setCategory(c.slug)
                  syncUrl({ category: c.slug })
                }}
                className={cn(
                  "relative shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  active ? "border-transparent text-primary-foreground" : "bg-card hover:bg-muted"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="chip-active"
                    className="absolute inset-0 -z-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
        {visible.length} {visible.length === 1 ? "product" : "products"}
      </p>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed py-20 text-center">
          <SearchXIcon className="size-10 text-muted-foreground" />
          <p className="font-heading text-xl">No matches found</p>
          <p className="text-sm text-muted-foreground">Try a different word or category.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {visible.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25 }}
              >
                <ProductCard product={p} priority={i < 4} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  )
}

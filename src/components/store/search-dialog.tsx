"use client"

import { ArrowLeftIcon, ArrowRightIcon, Loader2Icon, SearchXIcon, XIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { SearchField } from "@/components/form"
import { searchProducts, type SearchResult } from "@/features/products/search-actions"
import { formatPrice } from "@/lib/format"
import { ProductImage } from "./product-image"

type Category = { name: string; slug: string }

const MIN_SEARCH_CHARS = 2
const DEBOUNCE_MS = 300
const searchCache = new Map<string, SearchResult>()

/**
 * The store-wide search dialog: full-screen search view on mobile, floating dropdown card on tablet/desktop.
 * Results appear as you type (name matches first); Enter or "See all results" opens the full /products list.
 */
export function SearchDialog({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (open: boolean) => void; categories: Category[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<{ query: string; data: SearchResult } | null>(null)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const latest = useRef(0)
  const trimmed = query.trim()
  const cacheKey = trimmed.toLowerCase()
  const canSearch = trimmed.length >= MIN_SEARCH_CHARS

  // Close on Escape, trap Tab focus, or close on click outside
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false)
        return
      }
      if (e.key === "Tab" && dropdownRef.current) {
        const focusable = dropdownRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        const searchBtn = document.querySelector('[data-ui="store/Header/button-search-products"]')
        const mobileBtn = document.querySelector('[data-ui="store/Header/button-search-pill-mobile"]')
        if ((searchBtn && searchBtn.contains(e.target as Node)) || (mobileBtn && mobileBtn.contains(e.target as Node))) return
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("mousedown", onPointerDown)
    window.addEventListener("touchstart", onPointerDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("touchstart", onPointerDown)
    }
  }, [open, onOpenChange])

  // Debounced lookup with in-memory cache and 2-char minimum gate. A counter drops answers that arrive after a newer keystroke.
  useEffect(() => {
    if (!open || !canSearch) return
    const cached = searchCache.get(cacheKey)
    if (cached) {
      queueMicrotask(() => setResult({ query: trimmed, data: cached }))
      return
    }
    const id = ++latest.current
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const res = await searchProducts(trimmed)
        if (searchCache.size >= 50) {
          const oldest = searchCache.keys().next().value
          if (oldest !== undefined) searchCache.delete(oldest)
        }
        searchCache.set(cacheKey, res)
        if (id === latest.current) setResult({ query: trimmed, data: res })
      } catch {
        if (id === latest.current) setResult({ query: trimmed, data: { hits: [], total: 0 } })
      } finally {
        if (id === latest.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [trimmed, cacheKey, canSearch, open])

  const close = () => onOpenChange(false)
  const seeAll = () => {
    if (!trimmed) return
    close()
    router.push(`/products?q=${encodeURIComponent(trimmed)}`)
  }
  const shown = canSearch && (searchCache.get(cacheKey) ?? (result?.query === trimmed ? result.data : null))

  if (!open) return null

  return (
    <>
      <div data-ui="store/SearchDialog/div-fixed"
        data-slot="dialog-overlay"
        data-open=""
        className="fixed inset-0 z-50 hidden bg-black/25 transition-opacity sm:block supports-backdrop-filter:backdrop-blur-[2px]"
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={dropdownRef}
        data-ui="store/SearchDialog/div-search-products"
        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className="fixed inset-0 z-60 flex h-dvh w-screen flex-col overflow-hidden bg-background p-4 sm:inset-x-0 sm:top-[calc(var(--store-header-h)+8px)] sm:bottom-auto sm:mx-auto sm:h-auto sm:max-h-[calc(100dvh-5.5rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-lg sm:rounded-2xl sm:border sm:bg-card sm:shadow-2xl animate-in fade-in-0 duration-150"
      >
        <div data-ui="store/SearchDialog/div-flex" className="flex shrink-0 items-center gap-2 border-b pb-3 mb-3 sm:border-b-0 sm:pb-0">
          <button data-ui="store/SearchDialog/button-back"
            type="button"
            onClick={close}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:hidden"
            aria-label="Back"
          >
            <ArrowLeftIcon className="size-5" />
          </button>
          <form
            data-ui="store/SearchDialog/form"
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              seeAll()
            }}
            className="flex-1"
          >
            <SearchField
              label="Search products"
              maxLength={LIMITS.search.max}
              placeholder="Search products…"
              autoFocus
              autoComplete="off"
              pill
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
            />
          </form>
          <button data-ui="store/SearchDialog/button-close-search"
            type="button"
            onClick={close}
            className="hidden size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors sm:flex"
            aria-label="Close search"
          >
            <XIcon className="size-4.5" />
          </button>
        </div>

        <div data-ui="store/SearchDialog/div" aria-live="polite" className="min-h-16 flex-1 overflow-y-auto">
          {!canSearch && categories.length > 0 && (
            <div data-ui="store/SearchDialog/div-2" className="space-y-2.5">
              <p data-ui="store/SearchDialog/p" className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Browse categories</p>
              <ul data-ui="store/SearchDialog/ul-flex" className="flex flex-wrap gap-2">
                <li data-ui="store/SearchDialog/li">
                  <Link data-ui="store/SearchDialog/Link-all-products" href="/products" onClick={close} className="inline-flex h-9 sm:h-8 items-center rounded-full border px-3.5 text-xs font-medium hover:bg-muted transition-colors">
                    All products
                  </Link>
                </li>
                {categories.map((c) => (
                  <li data-ui="store/SearchDialog/li-2" key={c.slug}>
                    <Link data-ui="store/SearchDialog/Link-inline-flex" href={`/category/${c.slug}`} onClick={close} className="inline-flex h-9 sm:h-8 items-center rounded-full border px-3.5 text-xs font-medium hover:bg-muted transition-colors">
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canSearch && !shown && (
            <p data-ui="store/SearchDialog/p-flex" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          )}

          {shown && shown.hits.length === 0 && (
            <div data-ui="store/SearchDialog/div-flex-2" className="flex flex-col items-center gap-2 py-10 sm:py-6 text-center">
              <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
              <p data-ui="store/SearchDialog/p-2" className="text-sm font-medium">No products match “{trimmed}”</p>
              <p data-ui="store/SearchDialog/p-3" className="text-xs text-muted-foreground">Try a shorter word, or browse a category.</p>
            </div>
          )}

          {shown && shown.hits.length > 0 && (
            <>
              <ul data-ui="store/SearchDialog/ul" className="divide-y divide-border/60">
                {shown.hits.map((h) => (
                  <li data-ui="store/SearchDialog/li-3" key={h.id}>
                    <Link data-ui="store/SearchDialog/Link-flex" href={`/products/${h.slug}`} onClick={close} className="flex items-center gap-3 py-2.5 sm:py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
                      <span data-ui="store/SearchDialog/span-relative" className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={h.image} alt={h.name} sizes="48px" />
                      </span>
                      <span data-ui="store/SearchDialog/span" className="min-w-0 flex-1">
                        <span data-ui="store/SearchDialog/span-2" className="block truncate text-sm font-medium">{h.name}</span>
                        <span data-ui="store/SearchDialog/span-3" className="block truncate text-xs text-muted-foreground">
                          {h.category ?? "Product"}
                          {!h.inStock ? " · Out of stock" : ""}
                        </span>
                      </span>
                      <span data-ui="store/SearchDialog/span-4" className="shrink-0 text-sm font-semibold">
                        {formatPrice(h.price)}
                        {h.compareAtPrice && h.compareAtPrice > h.price && (
                          <span data-ui="store/SearchDialog/span-5" className="ml-1.5 text-xs font-normal text-muted-foreground line-through">{formatPrice(h.compareAtPrice)}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                data-ui="store/SearchDialog/button-see-all"
                type="button"
                onClick={seeAll}
                className="mt-3 flex h-10 sm:h-9.5 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                See all {shown.total} {shown.total === 1 ? "result" : "results"} <ArrowRightIcon className="size-3.5" aria-hidden />
              </button>
            </>
          )}
          {loading && shown && <span data-ui="store/SearchDialog/span-6" className="sr-only">Updating results</span>}
        </div>
      </div>
    </>
  )
}

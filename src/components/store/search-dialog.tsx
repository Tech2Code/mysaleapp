"use client"

import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, FlameIcon, Loader2Icon, SearchXIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { SearchField } from "@/components/form"
import { getSearchDiscovery, searchProducts, type SearchDiscovery, type SearchHit, type SearchResult } from "@/features/products/search-actions"
import { discountPercent, formatPrice } from "@/lib/format"
import { ProductImage } from "./product-image"

type Category = { name: string; slug: string }

const MIN_SEARCH_CHARS = 2
const DEBOUNCE_MS = 300
const RECENT_SEARCHES_KEY = "kk-recent-searches"
const MAX_RECENT_SEARCHES = 5
const searchCache = new Map<string, SearchResult>()
let cachedDiscovery: SearchDiscovery | null = null

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, MAX_RECENT_SEARCHES)
    }
  } catch {}
  return []
}

function writeRecentSearches(items: string[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)))
  } catch {}
}

function SearchMiniCard({
  hit,
  onSelect,
  onClose,
}: {
  hit: SearchHit
  onSelect: (href: string) => void
  onClose: () => void
}) {
  const off = discountPercent(hit.price, hit.compareAtPrice)
  const href = `/products/${hit.slug}`

  return (
    <Link
      data-ui="store/SearchMiniCard"
      href={href}
      onClick={(e) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault()
          onSelect(href)
        } else {
          onClose()
        }
      }}
      className="group flex items-center gap-2.5 rounded-xl border border-border/75 bg-card p-1.5 transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div data-ui="store/SearchMiniCard/div-relative" className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-12 @container">
        <ProductImage
          src={hit.image}
          alt={hit.name}
          sizes="48px"
          className={`transition-transform duration-300 ease-out group-hover:scale-105 ${!hit.inStock ? "opacity-60 grayscale" : ""}`}
        />
      </div>

      <div data-ui="store/SearchMiniCard/div" className="min-w-0 flex-1">
        <span data-ui="store/SearchMiniCard/span" className="block truncate font-sans text-xs font-semibold text-foreground group-hover:text-primary">
          {hit.name}
        </span>
        <div data-ui="store/SearchMiniCard/div-flex" className="mt-0.5 flex flex-wrap items-center gap-1 tabular-nums">
          <span data-ui="store/SearchMiniCard/span-2" className="text-xs font-bold text-foreground">
            {formatPrice(hit.price)}
          </span>
          {hit.compareAtPrice && hit.compareAtPrice > hit.price && (
            <span data-ui="store/SearchMiniCard/span-hidden" className="hidden text-[10px] text-muted-foreground line-through sm:inline">
              {formatPrice(hit.compareAtPrice)}
            </span>
          )}
          {off && (
            <span data-ui="store/SearchMiniCard/span-3" className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] leading-none font-semibold text-primary sm:text-[10px]">
              {off}% off
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * The store-wide search dialog: full-screen search view on mobile, floating dropdown card on tablet/desktop.
 * Results appear as you type (name matches first); Enter or "See all results" opens the full /products list.
 */
export function SearchDialog({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (open: boolean) => void; categories: Category[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<{ query: string; data: SearchResult } | null>(null)
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [discovery, setDiscovery] = useState<SearchDiscovery | null>(cachedDiscovery)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const latest = useRef(0)
  const pushedHistoryRef = useRef(false)
  const closingModeRef = useRef<"ui" | "pop" | "nav" | null>(null)
  const trimmed = query.trim()
  const cacheKey = trimmed.toLowerCase()
  const canSearch = trimmed.length >= MIN_SEARCH_CHARS

  const saveRecentTerm = useCallback((term: string) => {
    const clean = term.trim()
    if (clean.length < MIN_SEARCH_CHARS) return
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((t) => t.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT_SEARCHES)
      writeRecentSearches(next)
      return next
    })
  }, [])

  const removeRecentTerm = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const next = prev.filter((t) => t !== term)
      writeRecentSearches(next)
      return next
    })
  }, [])

  const clearRecentTerms = useCallback(() => {
    setRecentSearches([])
    writeRecentSearches([])
  }, [])

  // Load recent searches and discovery suggestions when dialog opens
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setRecentSearches(readRecentSearches())
    })
    if (cachedDiscovery) {
      queueMicrotask(() => {
        setDiscovery(cachedDiscovery)
      })
      return
    }
    let cancelled = false
    getSearchDiscovery()
      .then((res) => {
        cachedDiscovery = res
        if (!cancelled) setDiscovery(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  const close = useCallback(() => {
    if (!open) return
    closingModeRef.current = "ui"
    setQuery("")
    onOpenChange(false)
    if (pushedHistoryRef.current && typeof window !== "undefined" && window.history.state?.__searchDialog) {
      pushedHistoryRef.current = false
      window.history.back()
    } else {
      pushedHistoryRef.current = false
    }
  }, [open, onOpenChange])

  const navigateFromSearch = useCallback(
    (href: string, termToSave?: string) => {
      if (termToSave) saveRecentTerm(termToSave)
      closingModeRef.current = "nav"
      const hadPushedState = pushedHistoryRef.current && typeof window !== "undefined" && Boolean(window.history.state?.__searchDialog)
      pushedHistoryRef.current = false
      setQuery("")
      onOpenChange(false)
      // When SearchDialog opened it pushed a history entry on top of the current page.
      // Replacing that temporary entry with `href` leaves [previousPage, href] in history so Back goes straight to previousPage.
      if (hadPushedState || pathname === "/products") {
        router.replace(href)
      } else {
        router.push(href)
      }
    },
    [onOpenChange, pathname, router, saveRecentTerm]
  )

  // Push a shallow history state when opened so the browser/phone Back button closes Global Search instead of staying stuck on it
  useEffect(() => {
    if (!open) {
      closingModeRef.current = null
      return
    }
    closingModeRef.current = null
    if (typeof window !== "undefined" && !window.history.state?.__searchDialog) {
      window.history.pushState({ ...window.history.state, __searchDialog: true }, "")
      pushedHistoryRef.current = true
    }

    const onPopState = () => {
      if (closingModeRef.current === "ui") return
      closingModeRef.current = "pop"
      pushedHistoryRef.current = false
      setQuery("")
      onOpenChange(false)
    }

    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("popstate", onPopState)
    }
  }, [open, onOpenChange])

  // Auto-close if route or query changes externally while open
  const routeSignature = `${pathname}?${searchParams.toString()}`
  const lastRouteRef = useRef(routeSignature)
  useEffect(() => {
    if (lastRouteRef.current !== routeSignature) {
      lastRouteRef.current = routeSignature
      if (open) {
        pushedHistoryRef.current = false
        queueMicrotask(() => {
          setQuery("")
          onOpenChange(false)
        })
      }
    }
  }, [routeSignature, open, onOpenChange])

  // Close on Escape, trap Tab focus, or close on click outside
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close()
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
        close()
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
  }, [open, close])

  // Debounced lookup with in-memory cache and 2-char minimum gate. A counter drops answers that arrive after a newer keystroke.
  useEffect(() => {
    const id = ++latest.current
    if (!open || !canSearch) {
      queueMicrotask(() => setLoading(false))
      return
    }
    const cached = searchCache.get(cacheKey)
    if (cached) {
      queueMicrotask(() => {
        setLoading(false)
        setResult({ query: trimmed, data: cached })
      })
      return
    }
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

  const seeAll = () => {
    if (!trimmed) return
    navigateFromSearch(`/products?q=${encodeURIComponent(trimmed)}`, trimmed)
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
        className="fixed inset-0 z-60 flex h-dvh w-screen flex-col overflow-hidden bg-background p-3.5 sm:inset-x-0 sm:top-[calc(var(--store-header-h)+8px)] sm:bottom-auto sm:mx-auto sm:h-auto sm:max-h-[calc(100dvh-5rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-xl sm:rounded-2xl sm:border sm:bg-card sm:p-4 sm:shadow-2xl animate-in fade-in-0 duration-150"
      >
        <div data-ui="store/SearchDialog/div-flex" className="flex shrink-0 items-center gap-2 border-b pb-2.5 mb-2.5 sm:border-b-0 sm:pb-0">
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
              placeholder="Search products, gifts for men, candles…"
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

        <div data-ui="store/SearchDialog/div" aria-live="polite" className="min-h-16 flex-1 space-y-3 overflow-y-auto">
          {!canSearch && (
            <>
              {recentSearches.length > 0 && (
                <div data-ui="store/SearchDialog/div-2" className="space-y-1.5">
                  <div data-ui="store/SearchDialog/div-flex-2" className="flex items-center justify-between">
                    <p data-ui="store/SearchDialog/p-flex" className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      <ClockIcon className="size-3" aria-hidden /> Recent searches
                    </p>
                    <button data-ui="store/SearchDialog/button-clear-all"
                      type="button"
                      onClick={clearRecentTerms}
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <Trash2Icon className="size-3" aria-hidden /> Clear all
                    </button>
                  </div>
                  <ul data-ui="store/SearchDialog/ul-flex" className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <li data-ui="store/SearchDialog/li-inline-flex" key={term} className="inline-flex items-center rounded-full border bg-muted/40 text-xs font-medium transition-colors hover:bg-muted">
                        <button data-ui="store/SearchDialog/button-inline-flex"
                          type="button"
                          onClick={() => setQuery(term)}
                          className="inline-flex h-7 items-center gap-1 pl-2.5 pr-1 text-foreground"
                        >
                          <ClockIcon className="size-3 text-muted-foreground" aria-hidden />
                          <span data-ui="store/SearchDialog/span">{term}</span>
                        </button>
                        <button data-ui="store/SearchDialog/button-inline-flex-2"
                          type="button"
                          onClick={() => removeRecentTerm(term)}
                          aria-label={`Remove ${term} from recent searches`}
                          className="inline-flex size-5 mr-0.5 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          <XIcon className="size-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(categories.length > 0 || (discovery?.trendingTerms && discovery.trendingTerms.length > 0)) && (
                <div data-ui="store/SearchDialog/div-3" className="space-y-1.5">
                  <p data-ui="store/SearchDialog/p-flex-2" className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <FlameIcon className="size-3 text-primary" aria-hidden /> Trending &amp; categories
                  </p>
                  <ul data-ui="store/SearchDialog/ul-flex-2" className="flex flex-wrap gap-1.5">
                    {discovery?.trendingTerms.map((term) => (
                      <li data-ui="store/SearchDialog/li" key={`trend-${term}`}>
                        <button data-ui="store/SearchDialog/button-inline-flex-3"
                          type="button"
                          onClick={() => setQuery(term)}
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 text-xs font-medium text-foreground hover:bg-primary/15 transition-colors"
                        >
                          <FlameIcon className="size-3 text-primary" aria-hidden />
                          {term}
                        </button>
                      </li>
                    ))}
                    <li data-ui="store/SearchDialog/li-2">
                      <Link
                        data-ui="store/SearchDialog/Link-all-products"
                        href="/products"
                        onClick={(e) => {
                          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault()
                            navigateFromSearch("/products")
                          } else {
                            close()
                          }
                        }}
                        className="inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium hover:bg-muted transition-colors"
                      >
                        All products
                      </Link>
                    </li>
                    {categories.map((c) => (
                      <li data-ui="store/SearchDialog/li-3" key={c.slug}>
                        <Link
                          data-ui="store/SearchDialog/Link-inline-flex"
                          href={`/category/${c.slug}`}
                          onClick={(e) => {
                            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                              e.preventDefault()
                              navigateFromSearch(`/category/${c.slug}`)
                            } else {
                              close()
                            }
                          }}
                          className="inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium hover:bg-muted transition-colors"
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {discovery && discovery.recommended.length > 0 && (
                <div data-ui="store/SearchDialog/div-4" className="space-y-1.5">
                  <div data-ui="store/SearchDialog/div-flex-3" className="flex items-center justify-between">
                    <p data-ui="store/SearchDialog/p-flex-3" className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      <SparklesIcon className="size-3 text-primary" aria-hidden /> Trending &amp; recommended
                    </p>
                    <Link data-ui="store/SearchDialog/Link-view-all"
                      href="/products"
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                          e.preventDefault()
                          navigateFromSearch("/products")
                        } else {
                          close()
                        }
                      }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                  <div data-ui="store/SearchDialog/div-grid" className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {discovery.recommended.slice(0, 4).map((hit) => (
                      <SearchMiniCard
                        key={hit.id}
                        hit={hit}
                        onSelect={(href) => navigateFromSearch(href, hit.name)}
                        onClose={() => {
                          saveRecentTerm(hit.name)
                          close()
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {canSearch && !shown && (
            <p data-ui="store/SearchDialog/p-flex-4" className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden /> Searching…
            </p>
          )}

          {shown && shown.hits.length === 0 && (
            <div data-ui="store/SearchDialog/div-flex-4" className="flex flex-col items-center gap-2 py-10 sm:py-6 text-center">
              <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
              <p data-ui="store/SearchDialog/p" className="text-sm font-medium">No products match “{trimmed}”</p>
              <p data-ui="store/SearchDialog/p-2" className="text-xs text-muted-foreground">Try a shorter word, or browse a category.</p>
            </div>
          )}

          {shown && shown.hits.length > 0 && (
            <>
              {shown.isFallback && (
                <div data-ui="store/SearchDialog/div-5" className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  No exact match for <span data-ui="store/SearchDialog/span-2" className="font-semibold text-foreground">“{trimmed}”</span> — showing popular &amp; similar picks:
                </div>
              )}
              <ul data-ui="store/SearchDialog/ul" className="divide-y divide-border/60">
                {shown.hits.map((h) => (
                  <li data-ui="store/SearchDialog/li-4" key={h.id}>
                    <Link
                      data-ui="store/SearchDialog/Link-flex"
                      href={`/products/${h.slug}`}
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                          e.preventDefault()
                          navigateFromSearch(`/products/${h.slug}`, shown.isFallback ? h.name : trimmed)
                        } else {
                          saveRecentTerm(shown.isFallback ? h.name : trimmed)
                          close()
                        }
                      }}
                      className="flex items-center gap-3 py-2 sm:py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span data-ui="store/SearchDialog/span-relative" className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted @container">
                        <ProductImage src={h.image} alt={h.name} sizes="44px" />
                      </span>
                      <span data-ui="store/SearchDialog/span-3" className="min-w-0 flex-1">
                        <span data-ui="store/SearchDialog/span-4" className="block truncate text-sm font-medium">{h.name}</span>
                        <span data-ui="store/SearchDialog/span-5" className="block truncate text-xs text-muted-foreground">
                          {h.category ?? "Product"}
                          {!h.inStock ? " · Out of stock" : ""}
                        </span>
                      </span>
                      <span data-ui="store/SearchDialog/span-6" className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatPrice(h.price)}
                        {h.compareAtPrice && h.compareAtPrice > h.price && (
                          <span data-ui="store/SearchDialog/span-7" className="ml-1.5 text-xs font-normal text-muted-foreground line-through">{formatPrice(h.compareAtPrice)}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                data-ui="store/SearchDialog/button-flex"
                type="button"
                onClick={() => (shown.isFallback ? navigateFromSearch("/products") : seeAll())}
                className="mt-2 flex h-9.5 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {shown.isFallback ? (
                  <>Browse all products <ArrowRightIcon className="size-3.5" aria-hidden /></>
                ) : (
                  <>See all {shown.total} {shown.total === 1 ? "result" : "results"} <ArrowRightIcon className="size-3.5" aria-hidden /></>
                )}
              </button>
            </>
          )}
          {loading && shown && <span data-ui="store/SearchDialog/span-8" className="sr-only">Updating results</span>}
        </div>
      </div>
    </>
  )
}

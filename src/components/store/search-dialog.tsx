"use client"

import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, FlameIcon, Loader2Icon, SearchXIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react"
import { LIMITS } from "@/lib/validation"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { SearchField } from "@/components/form"
import { getSearchDiscovery, searchProducts, type SearchDiscovery, type SearchHit, type SearchResult } from "@/features/products/search-actions"
import { discountPercent, formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"
import styles from "./search-dialog.module.css"

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

      href={href}
      onClick={(e) => {
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault()
          onSelect(href)
        } else {
          onClose()
        }
      }}
      className={styles.miniCardLink}
    >
      <div className={styles.miniThumbBox}>
        <ProductImage
          src={hit.image}
          alt={hit.name}
          sizes="48px"
          className={cn(styles.miniThumbImg, !hit.inStock && styles.miniThumbSoldOut)}
        />
      </div>

      <div className={styles.miniInfoCol}>
        <span className={styles.miniTitle}>
          {hit.name}
        </span>
        <div className={styles.miniPriceRow}>
          <span className={styles.miniCurrentPrice}>
            {formatPrice(hit.price)}
          </span>
          {hit.compareAtPrice && hit.compareAtPrice > hit.price && (
            <span className={styles.miniComparePrice}>
              {formatPrice(hit.compareAtPrice)}
            </span>
          )}
          {off && (
            <span className={styles.miniOffBadge}>
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
        const target = e.target as Element | null
        if (target?.closest?.("[data-search-trigger]")) return
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
      <div
        data-slot="dialog-overlay"
        data-open=""
        className={styles.dialogBackdrop}
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={dropdownRef}

        role="dialog"
        aria-modal="true"
        aria-label="Search products"
        className={styles.dialogModal}
      >
        <div className={styles.topBar}>
          <button
            type="button"
            onClick={close}
            className={styles.mobileBackBtn}
            aria-label="Back"
          >
            <ArrowLeftIcon className={styles.backSvg} />
          </button>
          <form

            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              seeAll()
            }}
            className={styles.searchForm}
          >
            <SearchField
              label="Search products"
              maxLength={LIMITS.search.max}
              placeholder="Search products, gifts for men, candles…"
              autoFocus
              autoComplete="off"
              pill
              className={styles.desktopInputSurface}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => setQuery("")}
            />
          </form>
          <button
            type="button"
            onClick={close}
            className={styles.desktopCloseBtn}
            aria-label="Close search"
          >
            <XIcon className={styles.closeSvg} />
          </button>
        </div>

        <div aria-live="polite" className={styles.resultsScrollArea}>
          {!canSearch && (
            <>
              {recentSearches.length > 0 && (
                <div className={styles.discoverySection}>
                  <div className={styles.sectionHeaderRow}>
                    <p className={styles.sectionLabel}>
                      <ClockIcon className={styles.labelIcon} aria-hidden /> Recent searches
                    </p>
                    <button
                      type="button"
                      onClick={clearRecentTerms}
                      className={styles.clearAllBtn}
                    >
                      <Trash2Icon className={styles.trashSvg} aria-hidden /> Clear all
                    </button>
                  </div>
                  <ul className={styles.chipsList}>
                    {recentSearches.map((term) => (
                      <li key={term} className={styles.recentChipItem}>
                        <button
                          type="button"
                          onClick={() => setQuery(term)}
                          className={styles.recentTermBtn}
                        >
                          <ClockIcon className={styles.clockSvg} aria-hidden />
                          <span>{term}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRecentTerm(term)}
                          aria-label={`Remove ${term} from recent searches`}
                          className={styles.removeTermBtn}
                        >
                          <XIcon className={styles.xMiniSvg} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(categories.length > 0 || (discovery?.trendingTerms && discovery.trendingTerms.length > 0)) && (
                <div className={styles.discoverySection}>
                  <p className={styles.sectionLabel}>
                    <FlameIcon className={styles.labelAccentIcon} aria-hidden /> Trending &amp; categories
                  </p>
                  <ul className={styles.chipsList}>
                    {discovery?.trendingTerms.map((term) => (
                      <li key={`trend-${term}`}>
                        <button
                          type="button"
                          onClick={() => setQuery(term)}
                          className={styles.trendingChipBtn}
                        >
                          <FlameIcon className={styles.flameSvg} aria-hidden />
                          {term}
                        </button>
                      </li>
                    ))}
                    <li>
                      <Link

                        href="/products"
                        onClick={(e) => {
                          if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault()
                            navigateFromSearch("/products")
                          } else {
                            close()
                          }
                        }}
                        className={styles.categoryPillLink}
                      >
                        All products
                      </Link>
                    </li>
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link

                          href={`/category/${c.slug}`}
                          onClick={(e) => {
                            if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                              e.preventDefault()
                              navigateFromSearch(`/category/${c.slug}`)
                            } else {
                              close()
                            }
                          }}
                          className={styles.categoryPillLink}
                        >
                          {c.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {discovery && discovery.recommended.length > 0 && (
                <div className={styles.discoverySection}>
                  <div className={styles.sectionHeaderRow}>
                    <p className={styles.sectionLabel}>
                      <SparklesIcon className={styles.labelAccentIcon} aria-hidden /> Trending &amp; recommended
                    </p>
                    <Link
                      href="/products"
                      onClick={(e) => {
                        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
                          e.preventDefault()
                          navigateFromSearch("/products")
                        } else {
                          close()
                        }
                      }}
                      className={styles.viewAllLink}
                    >
                      View all
                    </Link>
                  </div>
                  <div className={styles.recommendedGrid}>
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
            <p className={styles.searchingRow}>
              <Loader2Icon className={styles.spinSvg} aria-hidden /> Searching…
            </p>
          )}

          {shown && shown.hits.length === 0 && (
            <div className={styles.noResultsBox}>
              <SearchXIcon className={styles.noResultsSvg} aria-hidden />
              <p className={styles.noResultsTitle}>No products match “{trimmed}”</p>
              <p className={styles.noResultsHint}>Try a shorter word, or browse a category.</p>
            </div>
          )}

          {shown && shown.hits.length > 0 && (
            <>
              {shown.isFallback && (
                <div className={styles.fallbackNotice}>
                  No exact match for <span className={styles.fallbackTerm}>“{trimmed}”</span> — showing popular &amp; similar picks:
                </div>
              )}
              <ul className={styles.hitsList}>
                {shown.hits.map((h) => (
                  <li key={h.id} className={styles.hitItem}>
                    <Link

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
                      className={styles.hitRowLink}
                    >
                      <span className={styles.hitThumbBox}>
                        <ProductImage src={h.image} alt={h.name} sizes="44px" />
                      </span>
                      <span className={styles.hitTextCol}>
                        <span className={styles.hitNameText}>{h.name}</span>
                        <span className={styles.hitMetaText}>
                          {h.category ?? "Product"}
                          {!h.inStock ? " · Out of stock" : ""}
                        </span>
                      </span>
                      <span className={styles.hitPriceCol}>
                        {formatPrice(h.price)}
                        {h.compareAtPrice && h.compareAtPrice > h.price && (
                          <span className={styles.hitStrikePrice}>{formatPrice(h.compareAtPrice)}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button

                type="button"
                onClick={() => (shown.isFallback ? navigateFromSearch("/products") : seeAll())}
                className={styles.seeAllBtn}
              >
                {shown.isFallback ? (
                  <>Browse all products <ArrowRightIcon className={styles.arrowSvg} aria-hidden /></>
                ) : (
                  <>See all {shown.total} {shown.total === 1 ? "result" : "results"} <ArrowRightIcon className={styles.arrowSvg} aria-hidden /></>
                )}
              </button>
            </>
          )}
          {loading && shown && <span className={styles.srOnlyStatus}>Updating results</span>}
        </div>
      </div>
    </>
  )
}

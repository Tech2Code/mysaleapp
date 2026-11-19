"use server"

import { z } from "zod"
import { LIMITS } from "@/lib/validation"
import { getActiveProducts } from "./queries"
import { buildSearchText, parseSearchQuery, priceDistanceToQuery, scoreProductSearch } from "./types"

export type SearchHit = {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  image: string | null
  category: string | null
  inStock: boolean
  isFeatured?: boolean
}

export type SearchResult = { hits: SearchHit[]; total: number; isFallback?: boolean }

export type SearchDiscovery = {
  trendingTerms: string[]
  recommended: SearchHit[]
}

const MAX_HITS = 6
const querySchema = z.string().trim().min(1).max(LIMITS.search.max)

function toSearchHit(p: Awaited<ReturnType<typeof getActiveProducts>>[number]): SearchHit {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.images[0] ?? null,
    category: p.category?.name ?? null,
    inStock: p.stock > 0,
    isFeatured: p.isFeatured,
  }
}

/**
 * Global store search (header search box). Reads the cached active catalogue, so it is cheap and public:
 * supports natural queries ("gifts for men", "candles under 600", singular/plural stems) and ranks relevance.
 */
export async function searchProducts(input: unknown): Promise<SearchResult> {
  const parsedInput = querySchema.safeParse(input)
  if (!parsedInput.success) return { hits: [], total: 0 }
  const parsed = parseSearchQuery(parsedInput.data)

  const allProducts = await getActiveProducts()
  const scored = allProducts
    .map((p) => {
      const score = scoreProductSearch(
        {
          name: p.name,
          price: p.price,
          category: p.category,
          isFeatured: p.isFeatured,
          searchText: buildSearchText(p),
        },
        parsed
      )
      if (score === null) return null
      return { p, score }
    })
    .filter((x): x is { p: Awaited<ReturnType<typeof getActiveProducts>>[number]; score: number } => x !== null)
    .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || b.score - a.score)

  if (scored.length === 0 && allProducts.length > 0) {
    // Tier 2: Relax price bounds first so keyword/category matches near the target price surface first (e.g. "candles under 200")
    const relaxedParsed = { ...parsed, minPrice: null, maxPrice: null }
    const relaxedMatches = allProducts
      .map((p) => {
        const score = scoreProductSearch(
          {
            name: p.name,
            price: p.price,
            category: p.category,
            isFeatured: p.isFeatured,
            searchText: buildSearchText(p),
          },
          relaxedParsed
        )
        if (score === null) return null
        return { p, score, dist: priceDistanceToQuery(p.price, parsed) }
      })
      .filter((x): x is { p: Awaited<ReturnType<typeof getActiveProducts>>[number]; score: number; dist: number } => x !== null)
      .sort((a, b) => Number(b.p.stock > 0) - Number(a.p.stock > 0) || a.dist - b.dist || b.score - a.score)

    if (relaxedMatches.length > 0) {
      return {
        total: 0,
        hits: relaxedMatches.slice(0, 4).map(({ p }) => toSearchHit(p)),
        isFallback: true,
      }
    }

    // Tier 3: Popular picks (sorted by price proximity if a price filter was given, then featured)
    const suggestions = allProducts
      .toSorted(
        (a, b) =>
          Number(b.stock > 0) - Number(a.stock > 0) ||
          priceDistanceToQuery(a.price, parsed) - priceDistanceToQuery(b.price, parsed) ||
          Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured))
      )
      .slice(0, 4)
      .map(toSearchHit)

    return {
      total: 0,
      hits: suggestions,
      isFallback: true,
    }
  }

  return {
    total: scored.length,
    hits: scored.slice(0, MAX_HITS).map(({ p }) => toSearchHit(p)),
  }
}

/**
 * Discovery data for the empty state of SearchDialog: trending search terms and 4 recommended products.
 */
export async function getSearchDiscovery(): Promise<SearchDiscovery> {
  const products = await getActiveProducts()
  const inStock = products.filter((p) => p.stock > 0)
  const pool = inStock.length > 0 ? inStock : products

  const sorted = pool.toSorted((a, b) => {
    const aFeat = Number(Boolean(a.isFeatured))
    const bFeat = Number(Boolean(b.isFeatured))
    if (bFeat !== aFeat) return bFeat - aFeat
    const aDisc = Number(Boolean(a.compareAtPrice && a.compareAtPrice > a.price))
    const bDisc = Number(Boolean(b.compareAtPrice && b.compareAtPrice > b.price))
    return bDisc - aDisc
  })

  const termSet = new Set<string>(["Gifts for men", "Gifts under 1000"])
  for (const p of sorted) {
    const shortWords = p.name.split(/\s+/).slice(0, 2).join(" ").replace(/[^\w\s-]/g, "").trim()
    if (shortWords.length >= 3) termSet.add(shortWords)
    if (termSet.size >= 4) break
  }

  return {
    trendingTerms: Array.from(termSet).slice(0, 4),
    recommended: sorted.slice(0, 4).map(toSearchHit),
  }
}

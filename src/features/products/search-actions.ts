"use server"

import { z } from "zod"
import { getActiveProducts } from "./queries"

export type SearchHit = {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  image: string | null
  category: string | null
  inStock: boolean
}

export type SearchResult = { hits: SearchHit[]; total: number }

const MAX_HITS = 6
const querySchema = z.string().trim().min(1).max(80)

/**
 * Global store search (header search box). Reads the cached active catalogue, so it is cheap and public:
 * name matches rank above description / category matches. Only active products are ever returned.
 */
export async function searchProducts(input: unknown): Promise<SearchResult> {
  const parsed = querySchema.safeParse(input)
  if (!parsed.success) return { hits: [], total: 0 }
  const words = parsed.data.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)

  const scored = (await getActiveProducts())
    .map((p) => {
      const name = p.name.toLowerCase()
      const rest = [p.description, p.shortDescription ?? "", p.category?.name ?? ""].join("\n").toLowerCase()
      if (!words.every((w) => name.includes(w) || rest.includes(w))) return null
      // lower is better: every word in the name, then a name that starts with the first word
      const inName = words.every((w) => name.includes(w))
      return { p, rank: (inName ? 0 : 2) + (name.startsWith(words[0]) ? 0 : 1) }
    })
    .filter((x): x is { p: Awaited<ReturnType<typeof getActiveProducts>>[number]; rank: number } => x !== null)
    .sort((a, b) => a.rank - b.rank)

  return {
    total: scored.length,
    hits: scored.slice(0, MAX_HITS).map(({ p }) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      image: p.images[0] ?? null,
      category: p.category?.name ?? null,
      inStock: p.stock > 0,
    })),
  }
}

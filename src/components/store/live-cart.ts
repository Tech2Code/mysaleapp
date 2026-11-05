"use client"

import { useMemo } from "react"
import { useMounted } from "@/hooks/use-mounted"
import { useCart, type CartItem } from "@/store/cart"

export type LiveProduct = { id: string; price: number; stock: number; name: string; images: string[]; slug: string }

export type LiveCartLine = CartItem & { available: boolean; priceChanged: boolean }

/**
 * Re-checks the saved cart against live catalogue data, so customers always
 * see current prices and stock. The server recalculates again at checkout.
 */
export function useLiveCart(products: LiveProduct[]) {
  const mounted = useMounted()
  const items = useCart((s) => s.items)

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines: LiveCartLine[] = (mounted ? items : []).map((item) => {
      const live = byId.get(item.productId)
      if (!live || live.stock <= 0) return { ...item, available: false, priceChanged: false }
      return {
        ...item,
        name: live.name,
        slug: live.slug,
        image: live.images[0] ?? item.image,
        price: live.price,
        maxQuantity: live.stock,
        quantity: Math.min(item.quantity, live.stock),
        available: true,
        priceChanged: live.price !== item.price,
      }
    })
    const available = lines.filter((l) => l.available)
    return {
      ready: mounted,
      lines,
      available,
      hasUnavailable: lines.length !== available.length,
      subtotal: available.reduce((n, l) => n + l.price * l.quantity, 0),
      count: available.reduce((n, l) => n + l.quantity, 0),
    }
  }, [items, products, mounted])
}

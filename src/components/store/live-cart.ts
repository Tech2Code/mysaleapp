"use client"

import { useMemo } from "react"
import { useMounted } from "@/hooks/use-mounted"
import { calculateCharges } from "@/features/orders/pricing"
import type { ShippingClass } from "@/features/products/types"
import { useCart, type CartItem } from "@/store/cart"
import { useStoreSettings } from "./store-settings-provider"

export type LiveProduct = {
  id: string
  price: number
  stock: number
  name: string
  images: string[]
  slug: string
  weightGrams: number
  shippingClass: ShippingClass
}

export type LiveCartLine = CartItem & {
  available: boolean
  priceChanged: boolean
  weightGrams: number
  shippingClass: ShippingClass
}

/**
 * Re-checks the saved cart against live catalogue data, so customers always
 * see current prices, stock and smart shipping/handling charges. The server recalculates again at checkout.
 */
export function useLiveCart(products: LiveProduct[]) {
  const mounted = useMounted()
  const items = useCart((s) => s.items)
  const settings = useStoreSettings()

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines: LiveCartLine[] = (mounted ? items : []).map((item) => {
      const live = byId.get(item.productId)
      if (!live || live.stock <= 0) {
        return { ...item, available: false, priceChanged: false, weightGrams: 0, shippingClass: "standard" }
      }
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
        weightGrams: live.weightGrams,
        shippingClass: live.shippingClass,
      }
    })
    const available = lines.filter((l) => l.available)
    const charges = calculateCharges(available, settings)
    return {
      ready: mounted,
      lines,
      available,
      hasUnavailable: lines.length !== available.length,
      /** Items total (without delivery / extra charges). */
      subtotal: charges.subtotal,
      charges,
      count: available.reduce((n, l) => n + l.quantity, 0),
    }
  }, [items, products, mounted, settings])
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useMounted } from "@/hooks/use-mounted"
import { calculateCharges } from "@/features/orders/pricing"
import type { ProductVariant, ShippingClass } from "@/features/products/types"
import { cartLineKey, MAX_QTY_PER_ITEM, useCart, type CartItem } from "@/store/cart"
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
  variants?: ProductVariant[]
}

function resolveLiveLine(live: LiveProduct | undefined, item: CartItem) {
  if (!live) return null
  const variants = live.variants ?? []
  if (variants.length > 0) {
    const matched = item.variantId ? variants.find((v) => v.id === item.variantId) : undefined
    if (!matched || matched.stock <= 0) return null
    return {
      price: matched.price,
      stock: matched.stock,
      variantId: matched.id,
      variantLabel: matched.label,
      variantSku: matched.sku ?? null,
    }
  }
  if (live.stock <= 0) return null
  return {
    price: live.price,
    stock: live.stock,
    variantId: undefined,
    variantLabel: undefined,
    variantSku: null,
  }
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
  const [priceChangedIds, setPriceChangedIds] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!mounted || products.length === 0 || items.length === 0) return
    const byId = new Map(products.map((p) => [p.id, p]))
    let changed = false
    const newlyChanged: string[] = []
    const synced = items.map((item) => {
      const live = byId.get(item.productId)
      const resolved = resolveLiveLine(live, item)
      if (!live || !resolved) return item
      const lineKey = cartLineKey(item)
      const nextQty = Math.min(item.quantity, resolved.stock, MAX_QTY_PER_ITEM)
      const nextImg = live.images[0] ?? item.image
      if (resolved.price !== item.price) {
        newlyChanged.push(lineKey)
      }
      if (
        nextQty !== item.quantity ||
        resolved.stock !== item.maxQuantity ||
        resolved.price !== item.price ||
        resolved.variantId !== item.variantId ||
        resolved.variantLabel !== item.variantLabel ||
        resolved.variantSku !== (item.variantSku ?? null) ||
        live.name !== item.name ||
        live.slug !== item.slug ||
        nextImg !== item.image
      ) {
        changed = true
        return {
          ...item,
          name: live.name,
          slug: live.slug,
          price: resolved.price,
          variantId: resolved.variantId,
          variantLabel: resolved.variantLabel,
          variantSku: resolved.variantSku,
          image: nextImg,
          maxQuantity: resolved.stock,
          quantity: nextQty,
        }
      }
      return item
    })
    if (newlyChanged.length > 0) {
      queueMicrotask(() => {
        setPriceChangedIds((prev) => {
          const next = new Set(prev)
          for (const id of newlyChanged) next.add(id)
          return next
        })
      })
    }
    if (changed) {
      useCart.setState({ items: synced })
    }
  }, [mounted, products, items])

  return useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    const lines: LiveCartLine[] = (mounted ? items : []).map((item) => {
      const live = byId.get(item.productId)
      const resolved = resolveLiveLine(live, item)
      const lineKey = cartLineKey(item)
      if (!live || !resolved) {
        return { ...item, available: false, priceChanged: false, weightGrams: 0, shippingClass: "standard" }
      }
      return {
        ...item,
        name: live.name,
        slug: live.slug,
        variantLabel: resolved.variantLabel,
        variantSku: resolved.variantSku,
        image: live.images[0] ?? item.image,
        price: resolved.price,
        maxQuantity: resolved.stock,
        quantity: Math.min(item.quantity, resolved.stock, MAX_QTY_PER_ITEM),
        available: true,
        priceChanged: priceChangedIds.has(lineKey) || resolved.price !== item.price,
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
  }, [items, products, mounted, settings, priceChangedIds])
}

"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { LIMITS } from "@/lib/validation"

export type CartItem = {
  productId: string
  variantId?: string
  variantLabel?: string
  variantSku?: string | null
  slug: string
  name: string
  price: number
  image: string | null
  quantity: number
  maxQuantity: number
}

/** Unique key for a cart line: separates distinct variants of the same product cleanly. */
export function cartLineKey(item: { productId: string; variantId?: string }): string {
  return item.variantId ? `${item.productId}::${item.variantId}` : item.productId
}

export const MAX_QTY_PER_ITEM = LIMITS.quantityPerItem.max

type CartState = {
  items: CartItem[]
  isOpen: boolean
  /** The line key that was added last, so the cart drawer can highlight it. Not saved. */
  lastAddedId: string | null
  add: (item: Omit<CartItem, "quantity">, quantity?: number, options?: { openDrawer?: boolean }) => void
  setQuantity: (lineKey: string, quantity: number) => void
  remove: (lineKey: string) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

const clampQty = (qty: number, max: number) => {
  const safeMax = Number.isFinite(max) ? Math.trunc(max) : 0
  if (safeMax < 1) return 0
  const safeQty = Number.isFinite(qty) ? Math.trunc(qty) : 1
  return Math.max(1, Math.min(safeQty, safeMax, MAX_QTY_PER_ITEM))
}

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.productId === "string" &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    typeof v.price === "number" &&
    Number.isFinite(v.price) &&
    v.price >= 0 &&
    (v.image === null || typeof v.image === "string") &&
    typeof v.quantity === "number" &&
    Number.isFinite(v.quantity) &&
    v.quantity >= 1 &&
    typeof v.maxQuantity === "number" &&
    Number.isFinite(v.maxQuantity)
  )
}

/** Guest-friendly cart stored on the device (localStorage). */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastAddedId: null,
      add: (item, quantity = 1, options) =>
        set((state) => {
          if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(item.maxQuantity) || item.maxQuantity < 1) {
            return state
          }
          const addQty = Math.trunc(quantity)
          if (addQty < 1) return state
          const openDrawer = options?.openDrawer ?? true
          const targetKey = cartLineKey(item)
          const existing = state.items.find((i) => cartLineKey(i) === targetKey)
          if (existing) {
            return {
              isOpen: openDrawer ? true : state.isOpen,
              lastAddedId: targetKey,
              items: state.items.map((i) =>
                cartLineKey(i) === targetKey
                  ? { ...i, ...item, quantity: clampQty(i.quantity + addQty, item.maxQuantity) }
                  : i
              ),
            }
          }
          return {
            isOpen: openDrawer ? true : state.isOpen,
            lastAddedId: targetKey,
            items: [...state.items, { ...item, quantity: clampQty(addQty, item.maxQuantity) }],
          }
        }),
      setQuantity: (lineKey, quantity) =>
        set((state) => {
          if (!Number.isFinite(quantity)) return state
          return {
            items: state.items
              .map((i) => (cartLineKey(i) === lineKey || i.productId === lineKey ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i))
              .filter((i) => i.quantity >= 1),
          }
        }),
      remove: (lineKey) =>
        set((state) => ({ items: state.items.filter((i) => cartLineKey(i) !== lineKey && i.productId !== lineKey) })),
      clear: () => set({ items: [] }),
      setOpen: (isOpen) => set(isOpen ? { isOpen } : { isOpen, lastAddedId: null }),
    }),
    {
      name: "kk-cart",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      merge: (persisted, current) => {
        const raw = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {}
        const items = Array.isArray(raw.items)
          ? raw.items
              .filter(isValidCartItem)
              .map((i) => ({ ...i, quantity: clampQty(i.quantity, Math.max(1, i.maxQuantity)) }))
              .filter((i) => i.quantity >= 1)
          : []
        return { ...current, items }
      },
    }
  )
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) =>
  Math.round((items.reduce((n, i) => n + i.price * i.quantity, 0) + Number.EPSILON) * 100) / 100

function findVisibleTarget(selector: string): HTMLElement | null {
  const targets = Array.from(document.querySelectorAll<HTMLElement>(selector))
  return (
    targets.find((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight
    }) ?? null
  )
}

function flyParabolicArc({
  fromRect,
  toRect,
  imageUrl,
  size = 44,
  duration = 480,
  reverseFade = false,
  dataAttr,
  onComplete,
}: {
  fromRect: DOMRect
  toRect: DOMRect
  imageUrl?: string | null
  size?: number
  duration?: number
  reverseFade?: boolean
  dataAttr: string
  onComplete: () => void
}) {
  const startX = fromRect.left + fromRect.width / 2 - size / 2
  const startY = fromRect.top + fromRect.height / 2 - size / 2
  const endX = toRect.left + toRect.width / 2 - size / 2
  const endY = toRect.top + toRect.height / 2 - size / 2
  const dist = Math.hypot(endX - startX, endY - startY)
  if (dist < 24) {
    onComplete()
    return
  }

  const ctrlX = (startX + endX) / 2
  const ctrlY = Math.min(startY, endY) - Math.max(88, Math.min(200, dist * 0.32))

  const flyer = document.createElement("div")
  flyer.setAttribute("aria-hidden", "true")
  flyer.setAttribute(dataAttr, "true")
  flyer.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:14px",
    "overflow:hidden",
    "pointer-events:none",
    "z-index:95",
    "box-shadow:0 12px 28px -6px rgba(11,35,60,0.34),0 0 0 2px var(--card,#fff)",
    "background:var(--primary,#ff6b5a)",
    "will-change:transform,opacity",
  ].join(";")

  if (imageUrl) {
    const img = document.createElement("img")
    img.src = imageUrl
    img.alt = ""
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;"
    img.onerror = () => img.remove()
    flyer.appendChild(img)
  }

  document.body.appendChild(flyer)

  const steps = 12
  const keyframes: Keyframe[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const inv = 1 - t
    const x = inv * inv * startX + 2 * inv * t * ctrlX + t * t * endX
    const y = inv * inv * startY + 2 * inv * t * ctrlY + t * t * endY
    const scale = reverseFade
      ? Math.max(0.25, 0.92 - t * 0.65)
      : i === 0
        ? 0.85
        : t < 0.35
          ? 0.85 + t * 0.7
          : Math.max(0.28, 1.1 - (t - 0.35) * 1.25)
    const rot = Math.sin(t * Math.PI) * (endX >= startX ? 12 : -12)
    const opacity = reverseFade
      ? Math.max(0, 1 - t * 0.92)
      : t > 0.84
        ? Math.max(0, 1 - (t - 0.84) / 0.16)
        : 1
    keyframes.push({
      transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`,
      opacity,
    })
  }

  let cleaned = false
  const finish = () => {
    if (cleaned) return
    cleaned = true
    flyer.remove()
    onComplete()
  }

  if (typeof flyer.animate === "function") {
    const anim = flyer.animate(keyframes, {
      duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    })
    anim.onfinish = finish
    anim.oncancel = finish
    window.setTimeout(finish, duration + 120)
  } else {
    finish()
  }
}

/**
 * Principle #7 (Moving in Arcs) + #8 (Secondary Action trigger):
 * Flies a lightweight GPU-composited product thumbnail along a parabolic Bezier arc from
 * the clicked button/card to the visible cart icon, bumps it, then invokes `onLand`.
 */
export function triggerFlyToCart(sourceEl: HTMLElement | null, imageUrl?: string | null, onLand?: () => void) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    onLand?.()
    return
  }
  const finishImmediate = () => {
    window.dispatchEvent(new CustomEvent("kk-cart-arc-landed"))
    onLand?.()
  }
  if (!sourceEl || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    finishImmediate()
    return
  }
  const target = findVisibleTarget('[data-cart-target="true"]')
  if (!target) {
    finishImmediate()
    return
  }
  flyParabolicArc({
    fromRect: sourceEl.getBoundingClientRect(),
    toRect: target.getBoundingClientRect(),
    imageUrl,
    size: 44,
    duration: 480,
    dataAttr: "data-cart-arc-flyer",
    onComplete: () => {
      window.dispatchEvent(new CustomEvent("kk-cart-arc-landed"))
      if (onLand) window.setTimeout(onLand, 90)
    },
  })
}

/**
 * Moving in Arcs for Wishlist:
 * - "add": flies product thumbnail from heart button -> visible wishlist icon, then bumps icon.
 * - "remove": bumps wishlist icon and flies thumbnail back out along a reverse parabolic arc.
 */
export function triggerFlyWishlist(
  sourceEl: HTMLElement | null,
  mode: "add" | "remove",
  imageUrl?: string | null
) {
  if (typeof window === "undefined" || typeof document === "undefined" || !sourceEl) return
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    window.dispatchEvent(new CustomEvent("kk-wishlist-arc-landed"))
    return
  }
  const target = findVisibleTarget('[data-wishlist-target="true"]')
  if (!target) {
    window.dispatchEvent(new CustomEvent("kk-wishlist-arc-landed"))
    return
  }
  const sourceRect = sourceEl.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  if (mode === "remove") {
    window.dispatchEvent(new CustomEvent("kk-wishlist-arc-landed"))
    flyParabolicArc({
      fromRect: targetRect,
      toRect: sourceRect,
      imageUrl,
      size: 40,
      duration: 460,
      reverseFade: true,
      dataAttr: "data-wishlist-arc-flyer",
      onComplete: () => {},
    })
    return
  }
  flyParabolicArc({
    fromRect: sourceRect,
    toRect: targetRect,
    imageUrl,
    size: 40,
    duration: 480,
    dataAttr: "data-wishlist-arc-flyer",
    onComplete: () => {
      window.dispatchEvent(new CustomEvent("kk-wishlist-arc-landed"))
    },
  })
}

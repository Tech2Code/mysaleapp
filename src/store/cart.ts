"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { LIMITS } from "@/lib/validation"

export type CartItem = {
  productId: string
  slug: string
  name: string
  price: number
  image: string | null
  quantity: number
  maxQuantity: number
}

export const MAX_QTY_PER_ITEM = LIMITS.quantityPerItem.max

type CartState = {
  items: CartItem[]
  isOpen: boolean
  /** The product that was added last, so the cart drawer can highlight it. Not saved. */
  lastAddedId: string | null
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
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
      add: (item, quantity = 1) =>
        set((state) => {
          if (!Number.isFinite(quantity) || quantity < 1 || !Number.isFinite(item.maxQuantity) || item.maxQuantity < 1) {
            return state
          }
          const addQty = Math.trunc(quantity)
          if (addQty < 1) return state
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              isOpen: true,
              lastAddedId: item.productId,
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, ...item, quantity: clampQty(i.quantity + addQty, item.maxQuantity) }
                  : i
              ),
            }
          }
          return {
            isOpen: true,
            lastAddedId: item.productId,
            items: [...state.items, { ...item, quantity: clampQty(addQty, item.maxQuantity) }],
          }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => {
          if (!Number.isFinite(quantity)) return state
          return {
            items: state.items
              .map((i) => (i.productId === productId ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i))
              .filter((i) => i.quantity >= 1),
          }
        }),
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
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
        const items = Array.isArray(raw.items) ? raw.items.filter(isValidCartItem) : []
        return { ...current, items }
      },
    }
  )
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) =>
  Math.round(items.reduce((n, i) => n + i.price * i.quantity, 0) * 100) / 100

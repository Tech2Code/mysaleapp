"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type CartItem = {
  productId: string
  slug: string
  name: string
  price: number
  image: string | null
  quantity: number
  maxQuantity: number
}

export const MAX_QTY_PER_ITEM = 20

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

const clampQty = (qty: number, max: number) =>
  Math.max(1, Math.min(qty, max, MAX_QTY_PER_ITEM))

/** Guest-friendly cart stored on the device (localStorage). */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      lastAddedId: null,
      add: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              isOpen: true,
              lastAddedId: item.productId,
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, ...item, quantity: clampQty(i.quantity + quantity, item.maxQuantity) }
                  : i
              ),
            }
          }
          return {
            isOpen: true,
            lastAddedId: item.productId,
            items: [...state.items, { ...item, quantity: clampQty(quantity, item.maxQuantity) }],
          }
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity: clampQty(quantity, i.maxQuantity) } : i
          ),
        })),
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
    }
  )
)

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.quantity, 0)
export const cartSubtotal = (items: CartItem[]) => items.reduce((n, i) => n + i.price * i.quantity, 0)

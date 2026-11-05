"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type WishlistState = {
  ids: string[]
  has: (id: string) => boolean
  setOn: (id: string, on: boolean) => void
  replaceAll: (ids: string[]) => void
  clear: () => void
}

/**
 * Wishlist ids. For guests this is the source of truth (saved on the device).
 * For signed-in users it mirrors the database — see components/shared/auth-listener.tsx.
 */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      has: (id) => get().ids.includes(id),
      setOn: (id, on) =>
        set((state) => ({
          ids: on ? [id, ...state.ids.filter((x) => x !== id)] : state.ids.filter((x) => x !== id),
        })),
      replaceAll: (ids) => set({ ids: Array.from(new Set(ids)) }),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "kk-wishlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids }),
    }
  )
)

"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type WishlistState = {
  ids: string[]
  ownerId: string | null
  has: (id: string) => boolean
  setOn: (id: string, on: boolean) => void
  setOwner: (ownerId: string | null) => void
  replaceAll: (ids: string[], ownerId?: string | null) => void
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
      ownerId: null,
      has: (id) => get().ids.includes(id),
      setOn: (id, on) =>
        set((state) => ({
          ids: on ? [id, ...state.ids.filter((x) => x !== id)] : state.ids.filter((x) => x !== id),
        })),
      setOwner: (ownerId) => set({ ownerId }),
      replaceAll: (ids, ownerId) =>
        set((state) => ({
          ids: Array.from(new Set(ids)),
          ownerId: ownerId === undefined ? state.ownerId : ownerId,
        })),
      clear: () => set({ ids: [], ownerId: null }),
    }),
    {
      name: "kk-wishlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ ids: state.ids, ownerId: state.ownerId }),
      merge: (persisted, current) => {
        const raw = persisted && typeof persisted === "object" ? (persisted as Record<string, unknown>) : {}
        const ids = Array.isArray(raw.ids) ? raw.ids.filter((x): x is string => typeof x === "string") : []
        const ownerId = typeof raw.ownerId === "string" ? raw.ownerId : null
        return { ...current, ids: Array.from(new Set(ids)), ownerId }
      },
    }
  )
)

"use client"

import { create } from "zustand"

export type SessionUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

type AuthState = {
  user: SessionUser | null
  /** false until the first session check finishes (avoids login-button flicker) */
  ready: boolean
  setUser: (user: SessionUser | null) => void
}

export const useAuth = create<AuthState>()((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user, ready: true }),
}))

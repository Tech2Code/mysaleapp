"use client"

import { create } from "zustand"

export type SessionUser = {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

const AUTH_CACHE_KEY = "kk-auth"

export function readCachedAuthSnapshot(): { known: boolean; user: SessionUser | null } {
  if (typeof window === "undefined") return { known: false, user: null }
  try {
    const raw = window.localStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return { known: false, user: null }
    const parsed = JSON.parse(raw) as { user?: SessionUser | null } | null
    if (!parsed || typeof parsed !== "object") return { known: false, user: null }
    const u = parsed.user
    if (
      u &&
      typeof u === "object" &&
      typeof u.id === "string" &&
      typeof u.email === "string" &&
      typeof u.name === "string"
    ) {
      return {
        known: true,
        user: {
          id: u.id,
          email: u.email,
          name: u.name,
          avatarUrl: typeof u.avatarUrl === "string" ? u.avatarUrl : null,
        },
      }
    }
    return { known: true, user: null }
  } catch {
    return { known: false, user: null }
  }
}

function writeCachedAuthSnapshot(user: SessionUser | null) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user }))
  } catch {}
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
  setUser: (user) => {
    writeCachedAuthSnapshot(user)
    set({ user, ready: true })
  },
}))

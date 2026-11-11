"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * "Install this app" support.
 *  - Android / desktop Chrome & Edge: the browser fires `beforeinstallprompt`; we keep it and show our own button.
 *  - iPhone / iPad: browsers never show an install popup, so we show the "Share → Add to Home Screen" steps.
 * The browser only offers installing on HTTPS (or localhost), never on a plain http://192.168… address.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

type State = { deferred: InstallEvent | null; installed: boolean; dismissed: boolean }

const DISMISS_KEY = "kk-install-dismissed"
const DISMISS_DAYS = 14

let state: State = { deferred: null, installed: false, dismissed: false }
const listeners = new Set<() => void>()
let started = false

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function start() {
  if (started) return
  started = true
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0)
    if (at && Date.now() - at < DISMISS_DAYS * 86_400_000) state = { ...state, dismissed: true }
  } catch {
    /* private mode: just don't remember */
  }
  if (isStandalone()) state = { ...state, installed: true }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault() // stop the browser's own mini-bar; we show ours
    set({ deferred: e as InstallEvent })
  })
  window.addEventListener("appinstalled", () => set({ installed: true, deferred: null }))
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getState = () => state
const serverState: State = { deferred: null, installed: true, dismissed: true } // render nothing on the server

export type InstallPromptApi = {
  /** Show an install button/banner at all? */
  canInstall: boolean
  /** iPhone/iPad: no prompt available, show the manual steps. */
  needsManualSteps: boolean
  /** The person already said "not now" (remembered for 14 days): don't show the banner, but a footer link may stay. */
  dismissed: boolean
  install: () => Promise<void>
  dismiss: () => void
}

export function useInstallPrompt(): InstallPromptApi {
  const s = useSyncExternalStore(subscribe, getState, () => serverState)
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)

  const install = useCallback(async () => {
    const e = state.deferred
    if (!e) return
    set({ deferred: null })
    try {
      await e.prompt()
      const { outcome } = await e.userChoice
      if (outcome === "accepted") set({ installed: true })
    } catch {
      /* browser dismissed or prompt already consumed */
    }
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    set({ dismissed: true })
  }, [])

  const needsManualSteps = isIos && !s.installed
  return { canInstall: !s.installed && (s.deferred !== null || needsManualSteps), needsManualSteps, dismissed: s.dismissed, install, dismiss }
}

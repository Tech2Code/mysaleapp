"use client"

import { Loader2Icon } from "lucide-react"
import { SuccessTick } from "@/components/shared/success-tick"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

type BusyApi = { begin: () => void; end: () => void; succeed: (message: string) => void }

const BusyContext = createContext<BusyApi>({ begin() {}, end() {}, succeed() {} })

/**
 * Turns the "Please wait…" pill into an animated green tick + message, on the same overlay and in the same spot.
 * Call it once the action worked (e.g. right before router.replace). Holds briefly so the tick animation finishes cleanly.
 */
export function useBusySuccess() {
  return useContext(BusyContext).succeed
}

/**
 * Blocks the whole page (clicks, Esc, Enter, Tab) while `active` is true and shows a loader.
 * Pair it with useTransition so nothing else can be pressed while a server action runs:
 *   const [pending, startTransition] = useTransition()
 *   useBlockWhile(pending)
 * Calls are counted, so overlapping actions are fine.
 */
export function useBlockWhile(active: boolean) {
  const { begin, end } = useContext(BusyContext)
  useEffect(() => {
    if (!active) return
    begin()
    return () => end()
  }, [active, begin, end])
}

const BLOCKED_KEYS = new Set(["Escape", "Enter", " ", "Tab"])
const SUCCESS_HOLD_MS = 620

export function BusyOverlayProvider({ children }: { children: ReactNode }) {
  const [{ count, success, lingering }, setState] = useState<{
    count: number
    success: string | null
    lingering: boolean
  }>({ count: 0, success: null, lingering: false })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const begin = useCallback(() => {
    clearHoldTimer()
    setState((s) => ({ count: s.count + 1, success: s.count === 0 ? null : s.success, lingering: false }))
  }, [clearHoldTimer])

  const end = useCallback(() => {
    setState((s) => {
      const nextCount = Math.max(0, s.count - 1)
      if (nextCount > 0) return { ...s, count: nextCount }
      if (s.success && timerRef.current) {
        return { count: 0, success: s.success, lingering: true }
      }
      return { count: 0, success: null, lingering: false }
    })
  }, [])

  const succeed = useCallback(
    (message: string) => {
      clearHoldTimer()
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        setState((s) => (s.count === 0 ? { count: 0, success: null, lingering: false } : s))
      }, SUCCESS_HOLD_MS)
      setState((s) => (s.count === 0 && !s.lingering ? s : { ...s, success: message }))
    },
    [clearHoldTimer]
  )

  useEffect(() => () => clearHoldTimer(), [clearHoldTimer])

  const api = useMemo(() => ({ begin, end, succeed }), [begin, end, succeed])
  const blocking = count > 0
  const visible = blocking || (lingering && Boolean(success))

  // Keyboard must not reach dialogs or buttons underneath while an action is actively running.
  useEffect(() => {
    if (!blocking) return
    const block = (e: KeyboardEvent) => {
      if (!BLOCKED_KEYS.has(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener("keydown", block, true)
    return () => window.removeEventListener("keydown", block, true)
  }, [blocking])

  return (
    <BusyContext value={api}>
      {children}
      {visible && (
        <div
          role="status"
          aria-live="polite"
          className={cn(styles.busyBackdrop, !blocking && styles.busyBackdropLinger)}
        >
          <div className={cn(styles.busyPill, success && styles.busyPillSuccess)}>
            {success ? <SuccessTick /> : <Loader2Icon className={styles.busySpinner} aria-hidden />}
            <span key={success ?? "wait"} className={success ? styles.busyTextSuccess : styles.busyTextWait}>
              {success ?? "Please wait…"}
            </span>
          </div>
        </div>
      )}
    </BusyContext>
  )
}

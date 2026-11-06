"use client"

import { Loader2Icon } from "lucide-react"
import { SuccessTick } from "@/components/shared/success-tick"
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

type BusyApi = { begin: () => void; end: () => void; succeed: (message: string) => void }

const BusyContext = createContext<BusyApi>({ begin() {}, end() {}, succeed() {} })

/**
 * Turns the "Please wait…" pill into a green tick + message, on the same overlay and in the same spot.
 * Call it once the action worked (e.g. right before router.replace). It clears itself when the overlay closes.
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

export function BusyOverlayProvider({ children }: { children: ReactNode }) {
  const [{ count, success }, setState] = useState<{ count: number; success: string | null }>({ count: 0, success: null })
  const begin = useCallback(() => setState((s) => ({ ...s, count: s.count + 1 })), [])
  // The success message dies with the overlay, so it can never be left over for the next screen.
  const end = useCallback(
    () => setState((s) => ({ count: Math.max(0, s.count - 1), success: s.count <= 1 ? null : s.success })),
    []
  )
  const succeed = useCallback((message: string) => setState((s) => ({ ...s, success: message })), [])
  const api = useMemo(() => ({ begin, end, succeed }), [begin, end, succeed])
  const busy = count > 0

  // Keyboard must not reach dialogs or buttons underneath (Esc would close a dialog mid-save).
  useEffect(() => {
    if (!busy) return
    const block = (e: KeyboardEvent) => {
      if (!BLOCKED_KEYS.has(e.key)) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener("keydown", block, true)
    return () => window.removeEventListener("keydown", block, true)
  }, [busy])

  return (
    <BusyContext value={api}>
      {children}
      {busy && (
        <div
          data-ui="shared/BusyOverlayProvider/div-grid"
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-90 grid cursor-wait place-items-center bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-150"
        >
          <div data-ui="shared/BusyOverlayProvider/div-flex" className="flex items-center gap-3 rounded-full bg-card px-5 py-3 text-sm font-medium text-card-foreground shadow-lg ring-1 ring-foreground/10">
            {success ? <SuccessTick /> : <Loader2Icon className="size-5 animate-spin text-primary" aria-hidden />}
            {success ?? "Please wait…"}
          </div>
        </div>
      )}
    </BusyContext>
  )
}

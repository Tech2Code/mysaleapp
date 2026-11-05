"use client"

import { usePathname, useSearchParams } from "next/navigation"
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

type ProgressApi = { start: () => void; done: () => void }

const ProgressContext = createContext<ProgressApi>({ start() {}, done() {} })

/** Start / finish the thin top progress bar by hand. Calls are counted, so overlapping work is fine. */
export function useRouteProgress(): ProgressApi {
  return useContext(ProgressContext)
}

/**
 * Keeps the top bar running while `active` is true. Pair it with useTransition:
 *   const [pending, startTransition] = useTransition()
 *   useProgressWhile(pending)
 * Use it instead of dimming the page (opacity) while something loads.
 */
export function useProgressWhile(active: boolean) {
  const { start, done } = useRouteProgress()
  useEffect(() => {
    if (!active) return
    start()
    return () => done()
  }, [active, start, done])
}

/** Finishes a click-started bar once the URL has actually changed. */
function RouteChangeWatcher({ onChange }: { onChange: () => void }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    // deferred so no state is set synchronously inside the effect
    const id = setTimeout(onChange, 0)
    return () => clearTimeout(id)
  }, [pathname, search, onChange])

  return null
}

/**
 * App-wide loading feedback: a slim bar at the very top of the screen.
 *  - starts on any in-app link click and finishes when the new page arrives;
 *  - can also be driven by useProgressWhile() for filters, tabs and forms.
 * The page itself is never faded or covered, so it feels fast.
 */
export function RouteProgressProvider({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0)
  const [visible, setVisible] = useState(false)
  const count = useRef(0)
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null)
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickPending = useRef(false)
  const clickGuard = useRef<ReturnType<typeof setTimeout> | null>(null)

  const start = useCallback(() => {
    count.current += 1
    if (count.current > 1) return
    if (hide.current) clearTimeout(hide.current)
    setVisible(true)
    setWidth(10)
    trickle.current = setInterval(() => setWidth((w) => w + (90 - w) * 0.12), 180)
  }, [])

  const done = useCallback(() => {
    count.current = Math.max(0, count.current - 1)
    if (count.current > 0) return
    if (trickle.current) clearInterval(trickle.current)
    setWidth(100)
    hide.current = setTimeout(() => {
      setVisible(false)
      setWidth(0)
    }, 300)
  }, [])

  const finishClick = useCallback(() => {
    if (!clickPending.current) return
    clickPending.current = false
    if (clickGuard.current) clearTimeout(clickGuard.current)
    done()
  }, [done])

  // Start the bar when an internal link is clicked.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (clickPending.current) return
      clickPending.current = true
      start()
      // safety net: never leave the bar running if the navigation was cancelled
      clickGuard.current = setTimeout(finishClick, 10_000)
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [start, finishClick])

  const api = useMemo(() => ({ start, done }), [start, done])

  return (
    <ProgressContext value={api}>
      {children}
      <Suspense fallback={null}>
        <RouteChangeWatcher onChange={finishClick} />
      </Suspense>
      <div data-ui="shared/RouteProgressProvider/div-fixed" aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-100 h-0.75">
        <div data-ui="shared/RouteProgressProvider/div"
          className={cn(
            "h-full rounded-r-full bg-primary shadow-[0_0_10px_var(--color-primary)] transition-[width,opacity] ease-out",
            visible ? "opacity-100 duration-200" : "opacity-0 duration-300"
          )}
          style={{ width: `${width}%` }}
        />
      </div>
    </ProgressContext>
  )
}

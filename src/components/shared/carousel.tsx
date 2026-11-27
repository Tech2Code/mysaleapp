"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

/**
 * A horizontally scrolling row with snap points. Touch: swipe. Desktop: arrow buttons that appear only
 * when the items overflow, plus a fade at the clipped edge. Children are the slides; give each one a
 * width (e.g. `w-[44%] sm:w-[23%]`) and `shrink-0 snap-start` via `slideClassName` on the wrapper.
 */
export function Carousel({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  const track = useRef<HTMLUListElement>(null)
  const animFrameRef = useRef<number | null>(null)
  const [edge, setEdge] = useState({ start: true, end: true })
  const [pager, setPager] = useState({ count: 1, active: 0 })

  const cancelScrollAnim = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    const el = track.current
    if (el) {
      el.style.scrollSnapType = ""
      el.style.scrollBehavior = ""
    }
  }, [])

  /** Principle #6 (Slow in, slow out): smooth cubic ease-in-out horizontal glide for carousel navigation. */
  const smoothScrollTo = useCallback(
    (targetLeft: number) => {
      const el = track.current
      if (!el) return
      cancelScrollAnim()
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
      const clamped = Math.max(0, Math.min(targetLeft, maxScroll))
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        el.scrollLeft = clamped
        return
      }
      const startLeft = el.scrollLeft
      const delta = clamped - startLeft
      if (Math.abs(delta) < 2) return
      const duration = 420
      const startTime = performance.now()
      el.style.scrollSnapType = "none"
      el.style.scrollBehavior = "auto"

      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration)
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        el.scrollLeft = startLeft + delta * eased
        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(tick)
        } else {
          el.style.scrollSnapType = ""
          el.style.scrollBehavior = ""
          animFrameRef.current = null
        }
      }
      animFrameRef.current = requestAnimationFrame(tick)
    },
    [cancelScrollAnim]
  )

  useEffect(() => cancelScrollAnim, [cancelScrollAnim])

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    const start = el.scrollLeft <= 4
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    const rawPages = el.clientWidth > 0 ? Math.ceil(el.scrollWidth / (el.clientWidth * 0.85)) : 1
    const count = maxScroll > 8 ? Math.min(6, Math.max(2, rawPages)) : 1
    const active =
      maxScroll > 8 && count > 1
        ? Math.min(count - 1, Math.max(0, Math.round((el.scrollLeft / maxScroll) * (count - 1))))
        : 0
    setEdge({ start, end })
    setPager((prev) => (prev.count === count && prev.active === active ? prev : { count, active }))
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure, children])

  const page = (dir: 1 | -1) => {
    const el = track.current
    if (el) smoothScrollTo(el.scrollLeft + dir * el.clientWidth * 0.82)
  }

  const jumpToPage = (idx: number) => {
    const el = track.current
    if (!el || pager.count <= 1) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    smoothScrollTo((idx / (pager.count - 1)) * maxScroll)
  }

  const overflowing = !(edge.start && edge.end)

  return (
    <div
      className={cn(styles.carouselRegion, className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          page(-1)
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          page(1)
        }
      }}
    >
      <div className={styles.carouselViewport}>
        <ul
          ref={track}
          onScroll={measure}
          onWheel={cancelScrollAnim}
          onTouchStart={cancelScrollAnim}
          className={styles.carouselTrack}
        >
          {children}
        </ul>
        {overflowing && (
          <>
            <button
              type="button"
              onClick={() => page(-1)}
              disabled={edge.start}
              aria-label={`Previous ${label}`}
              className={cn(styles.carouselArrowBtn, styles.carouselArrowPrev)}
            >
              <ChevronLeftIcon className={styles.arrowIcon20} />
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              disabled={edge.end}
              aria-label={`Next ${label}`}
              className={cn(styles.carouselArrowBtn, styles.carouselArrowNext)}
            >
              <ChevronRightIcon className={styles.arrowIcon20} />
            </button>
          </>
        )}
      </div>
      {overflowing && pager.count > 1 && (
        <div className={styles.carouselDotsRow} aria-hidden>
          {Array.from({ length: pager.count }, (_, idx) => (
            <button
              key={idx}
              type="button"
              tabIndex={-1}
              onClick={() => jumpToPage(idx)}
              className={cn(
                styles.carouselDotBtn,
                idx === pager.active && styles.carouselDotBtnActive
              )}
            />
          ))}
        </div>
      )}
    </div>
  )
}

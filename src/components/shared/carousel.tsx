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
  const [edge, setEdge] = useState({ start: true, end: true })
  const [pager, setPager] = useState({ count: 1, active: 0 })

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
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.82, behavior: "smooth" })
  }

  const jumpToPage = (idx: number) => {
    const el = track.current
    if (!el || pager.count <= 1) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    el.scrollTo({ left: (idx / (pager.count - 1)) * maxScroll, behavior: "smooth" })
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

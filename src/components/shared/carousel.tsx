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

  const measure = useCallback(() => {
    const el = track.current
    if (!el) return
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    const el = track.current
    if (!el) return
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const page = (dir: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" })
  }

  const overflowing = !(edge.start && edge.end)

  return (
    <div className={cn(styles.carouselRegion, className)} role="region" aria-roledescription="carousel" aria-label={label}>
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
            aria-label="Previous"
            className={cn(styles.carouselArrowBtn, styles.carouselArrowPrev)}
          >
            <ChevronLeftIcon className={styles.arrowIcon20} />
          </button>
          <button
            type="button"
            onClick={() => page(1)}
            disabled={edge.end}
            aria-label="Next"
            className={cn(styles.carouselArrowBtn, styles.carouselArrowNext)}
          >
            <ChevronRightIcon className={styles.arrowIcon20} />
          </button>
        </>
      )}
    </div>
  )
}

"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

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
    <div data-ui="shared/Carousel" className={cn("relative", className)} role="region" aria-roledescription="carousel" aria-label={label}>
      <ul data-ui="shared/Carousel/ul-flex"
        ref={track}
        onScroll={measure}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 py-2 scrollbar-none sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      {overflowing && (
        <>
          <button data-ui="shared/Carousel/button-previous"
            type="button"
            onClick={() => page(-1)}
            disabled={edge.start}
            aria-label="Previous"
            className="absolute top-1/2 -left-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background text-foreground shadow-lg transition-opacity hover:bg-secondary disabled:pointer-events-none disabled:opacity-0 md:grid"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <button data-ui="shared/Carousel/button-next"
            type="button"
            onClick={() => page(1)}
            disabled={edge.end}
            aria-label="Next"
            className="absolute top-1/2 -right-3 hidden size-10 -translate-y-1/2 place-items-center rounded-full border bg-background text-foreground shadow-lg transition-opacity hover:bg-secondary disabled:pointer-events-none disabled:opacity-0 md:grid"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </>
      )}
    </div>
  )
}

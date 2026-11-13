"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([])
  const list = images.length ? images : [null]
  const safeIndex = index < list.length ? index : 0

  const goTo = (nextIdx: number, dir?: number) => {
    if (list.length <= 1) return
    const normalized = (nextIdx + list.length) % list.length
    if (normalized === safeIndex) return
    setDirection(dir ?? (normalized > safeIndex ? 1 : -1))
    setIndex(normalized)
  }

  const goPrev = () => goTo(safeIndex - 1, -1)
  const goNext = () => goTo(safeIndex + 1, 1)

  useEffect(() => {
    const btn = thumbRefs.current[safeIndex]
    if (btn) {
      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
    }
  }, [safeIndex])

  return (
    <div data-ui="store/ProductGallery" className="flex flex-col-reverse gap-3 md:flex-row">
      {list.length > 1 && (
        <div data-ui="store/ProductGallery/div-product-photos" className="scroll-row flex gap-2.5 md:w-23 md:flex-col md:gap-3" role="group" aria-label="Product photos">
          {list.map((src, i) => (
            <button data-ui="store/ProductGallery/button"
              key={`${src ?? "empty"}-${i}`}
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              type="button"
              aria-pressed={i === safeIndex}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(
                "relative aspect-square w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition-all sm:w-20 @container",
                i === safeIndex ? "ring-primary" : "opacity-70 ring-transparent hover:opacity-100"
              )}
            >
              <ProductImage src={src} alt={`${name} thumbnail ${i + 1}`} sizes="80px" />
            </button>
          ))}
        </div>
      )}

      <div
        data-ui="store/ProductGallery/div-relative"
        tabIndex={list.length > 1 ? 0 : undefined}
        onKeyDown={(e) => {
          if (list.length <= 1) return
          if (e.key === "ArrowLeft") {
            e.preventDefault()
            goPrev()
          } else if (e.key === "ArrowRight") {
            e.preventDefault()
            goNext()
          }
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || list.length <= 1) return
          const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
          touchStartX.current = null
          if (Math.abs(delta) < 40) return
          if (delta < 0) goNext()
          else goPrev()
        }}
        className="group relative aspect-4/5 flex-1 overflow-hidden rounded-2xl bg-muted select-none sm:rounded-3xl @container"
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div data-ui="store/ProductGallery/m.div-absolute"
            key={safeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 24 : -24, scale: 1.01 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction >= 0 ? -24 : 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <ProductImage
              src={list[safeIndex]}
              alt={name}
              priority={safeIndex === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </m.div>
        </AnimatePresence>

        {list.length > 1 && (
          <>
            <button
              data-ui="store/ProductGallery/button-prev"
              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className="absolute top-1/2 left-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-md ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-background active:scale-95 sm:size-10 dark:ring-white/15"
            >
              <ChevronLeftIcon className="size-5" />
            </button>
            <button
              data-ui="store/ProductGallery/button-next"
              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className="absolute top-1/2 right-3 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-md ring-1 ring-black/10 backdrop-blur-sm transition-all hover:bg-background active:scale-95 sm:size-10 dark:ring-white/15"
            >
              <ChevronRightIcon className="size-5" />
            </button>
            <span
              data-ui="store/ProductGallery/span-absolute"
              aria-hidden
              className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full bg-black/60 px-2.5 py-0.5 text-[0.7rem] font-semibold text-white tabular-nums backdrop-blur-sm"
            >
              {safeIndex + 1} / {list.length}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

"use client"

import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const list = images.length ? images : [null]
  const safeIndex = index < list.length ? index : 0

  return (
    <div data-ui="store/ProductGallery" className="flex flex-col-reverse gap-3 md:flex-row">
      {list.length > 1 && (
        <div data-ui="store/ProductGallery/div-product-photos" className="scroll-row flex gap-2.5 md:w-23 md:flex-col md:gap-3" role="group" aria-label="Product photos">
          {list.map((src, i) => (
            <button data-ui="store/ProductGallery/button"
              key={`${src ?? "empty"}-${i}`}
              type="button"
              aria-pressed={i === safeIndex}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setIndex(i)}
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
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || list.length <= 1) return
          const delta = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
          touchStartX.current = null
          if (Math.abs(delta) < 40) return
          if (delta < 0) setIndex((safeIndex + 1) % list.length)
          else setIndex((safeIndex - 1 + list.length) % list.length)
        }}
        className="relative aspect-4/5 flex-1 overflow-hidden rounded-2xl bg-muted sm:rounded-3xl @container"
      >
        <AnimatePresence mode="wait" initial={false}>
          <m.div data-ui="store/ProductGallery/m.div-absolute"
            key={safeIndex}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
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
          <span
            data-ui="store/ProductGallery/span-absolute"
            aria-hidden
            className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/55 px-2.5 py-0.5 text-[0.7rem] font-semibold text-white tabular-nums backdrop-blur-sm sm:hidden"
          >
            {safeIndex + 1} / {list.length}
          </span>
        )}
      </div>
    </div>
  )
}

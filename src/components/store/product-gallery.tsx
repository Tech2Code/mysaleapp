"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import styles from "./product-detail.module.css"
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
    <div className={styles.galleryLayout}>
      {list.length > 1 && (
        <div className={styles.thumbRail} role="group" aria-label="Product photos">
          {list.map((src, i) => (
            <button
              key={`${src ?? "empty"}-${i}`}
              ref={(el) => {
                thumbRefs.current[i] = el
              }}
              type="button"
              aria-pressed={i === safeIndex}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => goTo(i)}
              className={cn(styles.thumbBtn, i === safeIndex && styles.thumbBtnActive)}
            >
              <ProductImage src={src} alt={`${name} thumbnail ${i + 1}`} sizes="80px" />
            </button>
          ))}
        </div>
      )}

      <div

        role={list.length > 1 ? "region" : undefined}
        aria-label={list.length > 1 ? `${name} photo ${safeIndex + 1} of ${list.length}` : undefined}
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
        className={styles.mainStage}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div
            key={safeIndex}
            custom={direction}
            initial={{ opacity: 0, x: direction >= 0 ? 24 : -24, scale: 1.01 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction >= 0 ? -24 : 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className={styles.slideLayer}
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

              type="button"
              onClick={goPrev}
              aria-label="Previous photo"
              className={styles.navArrowPrev}
            >
              <ChevronLeftIcon className={styles.arrowIcon} />
            </button>
            <button

              type="button"
              onClick={goNext}
              aria-label="Next photo"
              className={styles.navArrowNext}
            >
              <ChevronRightIcon className={styles.arrowIcon} />
            </button>
            <span

              aria-hidden
              className={styles.photoCounterPill}
            >
              {safeIndex + 1} / {list.length}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

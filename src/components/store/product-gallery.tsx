"use client"

import { AnimatePresence } from "motion/react"
import * as m from "motion/react-m"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0)
  const list = images.length ? images : [null]

  return (
    <div data-ui="store/ProductGallery" className="flex flex-col-reverse gap-3 md:flex-row">
      {list.length > 1 && (
        <div data-ui="store/ProductGallery/div-product-photos" className="scroll-row flex gap-3 md:w-23 md:flex-col" role="tablist" aria-label="Product photos">
          {list.map((src, i) => (
            <button data-ui="store/ProductGallery/button"
              key={src ?? i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition-all @container",
                i === index ? "ring-primary" : "opacity-70 ring-transparent hover:opacity-100"
              )}
            >
              <ProductImage src={src} alt={`${name} thumbnail ${i + 1}`} sizes="80px" />
            </button>
          ))}
        </div>
      )}

      <div data-ui="store/ProductGallery/div-relative" className="relative aspect-4/5 flex-1 overflow-hidden rounded-3xl bg-muted @container">
        <AnimatePresence mode="wait" initial={false}>
          <m.div data-ui="store/ProductGallery/m.div-absolute"
            key={index}
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <ProductImage
              src={list[index]}
              alt={name}
              priority={index === 0}
              sizes="(min-width: 1024px) 50vw, 100vw"
            />
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

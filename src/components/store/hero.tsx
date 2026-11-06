"use client"

import { ArrowRightIcon, SparklesIcon } from "lucide-react"
import * as m from "motion/react-m"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { useStoreSettings } from "./store-settings-provider"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"
import { WhatsAppIcon } from "./brand-icons"

const ease = [0.22, 1, 0.36, 1] as const

export function Hero({ showcase }: { showcase: Pick<Product, "id" | "slug" | "name" | "price" | "images">[] }) {
  const { description, heroBadge } = useStoreSettings()
  const [a, b, c] = showcase

  return (
    <section data-ui="store/Hero" className="relative isolate overflow-hidden bg-hero">
      {/* Soft animated colour blobs */}
      <div data-ui="store/Hero/div-absolute" aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-ui="store/Hero/div-absolute-2" className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
        <div data-ui="store/Hero/div-absolute-3" className="absolute top-1/3 -right-24 size-112 rounded-full bg-rose-300/30 blur-3xl animate-blob [animation-delay:-6s] dark:bg-rose-900/30" />
        <div data-ui="store/Hero/div-absolute-4" className="absolute -bottom-32 left-1/3 size-96 rounded-full bg-amber-200/40 blur-3xl animate-blob [animation-delay:-12s] dark:bg-amber-900/20" />
      </div>

      <div data-ui="store/Hero/div-grid" className="container-page grid items-center gap-8 sm:gap-12 pt-10 pb-20 md:pt-16 lg:grid-cols-2 lg:pb-28">
        <div data-ui="store/Hero/div" className="max-w-xl">
          <m.span data-ui="store/Hero/m.span-inline-flex"
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur"
          >
            <SparklesIcon className="size-3.5" /> {heroBadge}
          </m.span>

          <m.h1 data-ui="store/Hero/m.h1"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.08 }}
            className="mt-6 text-5xl font-semibold sm:text-6xl lg:text-7xl"
          >
            Little things, <span data-ui="store/Hero/span" className="text-gradient italic">made by hand</span>, loved for years.
          </m.h1>

          <m.p data-ui="store/Hero/m.p"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.16 }}
            className="mt-6 max-w-lg text-lg/relaxed  text-muted-foreground"
          >
            {description}
          </m.p>

          <m.div data-ui="store/Hero/m.div-flex"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link data-ui="store/Hero/Link-shop-the-collection"
              href="/products"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group h-12 rounded-full px-7 text-base shadow-xl shadow-primary/25"
              )}
            >
              Shop the collection
              <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
            </Link>
            <span data-ui="store/Hero/span-inline-flex" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <WhatsAppIcon className="size-5 text-whatsapp" /> Easy ordering on WhatsApp
            </span>
          </m.div>
        </div>

        {/* Floating product collage */}
        {a && (
          <div data-ui="store/Hero/div-relative" className="relative mx-auto aspect-square w-full max-w-lg">
            {[a, b, c].map((p, i) =>
              p ? (
                <m.div data-ui="store/Hero/m.div"
                  key={p.id}
                  initial={{ scale: 0.85, rotate: 0 }}
                  animate={{ scale: 1, rotate: [-6, 5, -3][i] }}
                  transition={{ duration: 0.9, ease, delay: 0.2 + i * 0.12 }}
                  className={cn(
                    "absolute",
                    i === 0 && "top-0 left-[6%] z-20 w-[55%]",
                    i === 1 && "top-[18%] right-0 z-10 w-[48%]",
                    i === 2 && "bottom-0 left-[22%] z-30 w-[46%]"
                  )}
                >
                  <Link data-ui="store/Hero/Link"
                    href={`/products/${p.slug}`}
                    className="group block animate-float rounded-3xl bg-card p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5"
                    style={{ animationDelay: `${-i * 2}s` }}
                  >
                    <div data-ui="store/Hero/div-relative-2" className="relative aspect-4/5 overflow-hidden rounded-2xl @container">
                      <ProductImage
                        src={p.images[0]}
                        alt={p.name}
                        sizes="(min-width: 1024px) 280px, 50vw"
                        priority={i === 0}
                        className="transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div data-ui="store/Hero/div-flex" className="flex items-center justify-between gap-2 px-1.5 pt-2 pb-0.5">
                      <span data-ui="store/Hero/span-2" className="truncate text-xs font-semibold">{p.name}</span>
                      <span data-ui="store/Hero/span-3" className="shrink-0 text-xs font-bold text-primary">{formatPrice(p.price)}</span>
                    </div>
                  </Link>
                </m.div>
              ) : null
            )}
          </div>
        )}
      </div>
    </section>
  )
}

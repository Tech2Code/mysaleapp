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
      {/* Soft animated colour blobs (static on phones to avoid heavy blur-3xl GPU overdraw during scroll) */}
      <div data-ui="store/Hero/div-absolute" aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden contain-paint">
        <div data-ui="store/Hero/div-absolute-2" className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/20 blur-3xl sm:animate-blob sm:will-change-transform" />
        <div data-ui="store/Hero/div-absolute-3" className="absolute top-1/3 -right-24 size-112 rounded-full bg-rose-300/30 blur-3xl sm:animate-blob sm:will-change-transform [animation-delay:-6s] dark:bg-rose-900/30" />
        <div data-ui="store/Hero/div-absolute-4" className="absolute -bottom-32 left-1/3 size-96 rounded-full bg-amber-200/40 blur-3xl sm:animate-blob sm:will-change-transform [animation-delay:-12s] dark:bg-amber-900/20" />
      </div>

      <div data-ui="store/Hero/div-grid" className="container-page grid items-center gap-8 py-10 sm:gap-10 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
        <div data-ui="store/Hero/div" className="max-w-xl">
          <m.span data-ui="store/Hero/m.span-inline-flex"
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.35, ease }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-xs backdrop-blur"
          >
            <SparklesIcon className="size-3.5" /> {heroBadge}
          </m.span>

          <m.h1 data-ui="store/Hero/m.h1"
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.04 }}
            className="mt-4 text-5xl font-semibold sm:mt-5 sm:text-6xl lg:text-7xl"
          >
            Little things, <span data-ui="store/Hero/span" className="text-gradient italic">made by hand</span>, loved for years.
          </m.h1>

          <m.p data-ui="store/Hero/m.p"
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.08 }}
            className="mt-3.5 max-w-lg text-base/relaxed text-muted-foreground sm:mt-5 sm:text-lg/relaxed"
          >
            {description}
          </m.p>

          <m.div data-ui="store/Hero/m.div-flex"
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.12 }}
            className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:mt-7"
          >
            <Link data-ui="store/Hero/Link"
              href="/products"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group h-12 gap-2.5 rounded-full pl-7 pr-5.5 text-base leading-none font-semibold shadow-xl shadow-primary/25"
              )}
            >
              <span data-ui="store/Hero/span-2">Shop the collection</span>
              <ArrowRightIcon className="size-4.5 translate-y-[0.5px] transition-transform group-hover:translate-x-1" />
            </Link>
            <span data-ui="store/Hero/span-inline-flex" className="inline-flex items-center gap-2 py-1 text-sm leading-none font-medium text-muted-foreground">
              <WhatsAppIcon className="size-4.5 shrink-0 text-whatsapp" />
              <span data-ui="store/Hero/span-3">Easy ordering on WhatsApp</span>
            </span>
          </m.div>
        </div>

        {/* Floating product collage */}
        {a && (
          <div data-ui="store/Hero/div-relative-2" className="relative mx-auto aspect-square w-full max-w-md sm:max-w-lg">
            {[a, b, c].map((p, i) =>
              p ? (
                <div data-ui="store/Hero/m.div"
                  key={p.id}
                  className={cn(
                    "absolute",
                    i === 0 && "top-0 left-[4%] z-20 w-[52%] -rotate-6",
                    i === 1 && "top-[16%] right-[4%] z-10 w-[48%] rotate-5",
                    i === 2 && "bottom-0 left-[27%] z-30 w-[46%] -rotate-3"
                  )}
                >
                  <Link data-ui="store/Hero/Link-3"
                    href={`/products/${p.slug}`}
                    className="group block animate-float rounded-3xl bg-card p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5"
                    style={{ animationDelay: `${-i * 2}s` }}
                  >
                    <div data-ui="store/Hero/div-relative-3" className="relative aspect-4/5 overflow-hidden rounded-2xl @container">
                      <ProductImage
                        src={p.images[0]}
                        alt={p.name}
                        sizes="(min-width: 1024px) 280px, 50vw"
                        priority={i === 0}
                        className="transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div data-ui="store/Hero/div-flex" className="flex items-center justify-between gap-2 px-1.5 pt-2 pb-0.5">
                      <span data-ui="store/Hero/span-4" className="truncate text-xs font-semibold">{p.name}</span>
                      <span data-ui="store/Hero/span-5" className="shrink-0 text-xs font-bold text-primary">{formatPrice(p.price)}</span>
                    </div>
                  </Link>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </section>
  )
}

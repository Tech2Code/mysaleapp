"use client"

import { ArrowRightIcon, SparklesIcon } from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ProductImage } from "./product-image"
import { WhatsAppIcon } from "./brand-icons"

const ease = [0.22, 1, 0.36, 1] as const

export function Hero({ showcase }: { showcase: Pick<Product, "id" | "slug" | "name" | "price" | "images">[] }) {
  const [a, b, c] = showcase

  return (
    <section className="relative isolate overflow-hidden bg-hero">
      {/* Soft animated colour blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-24 size-[28rem] rounded-full bg-rose-300/30 blur-3xl animate-blob [animation-delay:-6s] dark:bg-rose-900/30" />
        <div className="absolute -bottom-32 left-1/3 size-96 rounded-full bg-amber-200/40 blur-3xl animate-blob [animation-delay:-12s] dark:bg-amber-900/20" />
      </div>

      <div className="container-page grid items-center gap-12 pt-10 pb-20 md:pt-16 lg:grid-cols-2 lg:pb-28">
        <div className="max-w-xl">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm backdrop-blur"
          >
            <SparklesIcon className="size-3.5" /> Handmade in India · Made to be gifted
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.08 }}
            className="mt-6 text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
          >
            Little things, <span className="text-gradient italic">made by hand</span>, loved for years.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.16 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground"
          >
            {siteConfig.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              href="/products"
              className={cn(
                buttonVariants({ size: "lg" }),
                "group h-12 rounded-full px-7 text-base shadow-xl shadow-primary/25"
              )}
            >
              Shop the collection
              <ArrowRightIcon className="transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <WhatsAppIcon className="size-5 text-whatsapp" /> Easy ordering on WhatsApp
            </span>
          </motion.div>
        </div>

        {/* Floating product collage */}
        {a && (
          <div className="relative mx-auto aspect-square w-full max-w-lg">
            {[a, b, c].map((p, i) =>
              p ? (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.85, rotate: 0 }}
                  animate={{ opacity: 1, scale: 1, rotate: [-6, 5, -3][i] }}
                  transition={{ duration: 0.9, ease, delay: 0.2 + i * 0.12 }}
                  className={cn(
                    "absolute",
                    i === 0 && "top-0 left-[6%] z-20 w-[55%]",
                    i === 1 && "top-[18%] right-0 z-10 w-[48%]",
                    i === 2 && "bottom-0 left-[22%] z-30 w-[46%]"
                  )}
                >
                  <Link
                    href={`/products/${p.slug}`}
                    className="group block animate-float rounded-3xl bg-card p-2 shadow-2xl shadow-black/10 ring-1 ring-black/5"
                    style={{ animationDelay: `${-i * 2}s` }}
                  >
                    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl @container">
                      <ProductImage
                        src={p.images[0]}
                        alt={p.name}
                        sizes="(min-width: 1024px) 280px, 50vw"
                        priority={i === 0}
                        className="transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1.5 pt-2 pb-0.5">
                      <span className="truncate text-xs font-semibold">{p.name}</span>
                      <span className="shrink-0 text-xs font-bold text-primary">{formatPrice(p.price)}</span>
                    </div>
                  </Link>
                </motion.div>
              ) : null
            )}
          </div>
        )}
      </div>
    </section>
  )
}

"use client"

import { ArrowRightIcon, SparklesIcon } from "lucide-react"
import * as m from "motion/react-m"
import Link from "next/link"
import { useStoreSettings } from "./store-settings-provider"
import type { Product } from "@/features/products/types"
import { formatPrice } from "@/lib/format"
import { ProductImage } from "./product-image"
import styles from "./hero.module.css"

const ease = [0.22, 1, 0.36, 1] as const
const collagePositions = [styles.collageItemFirst, styles.collageItemSecond, styles.collageItemThird] as const

const DEFAULT_HEADLINE = "Little things, made by hand, loved for years."

export function Hero({
  showcase,
  headline = DEFAULT_HEADLINE,
}: {
  showcase: Pick<Product, "id" | "slug" | "name" | "price" | "images">[]
  headline?: string
}) {
  const { description, heroBadge } = useStoreSettings()
  const [a, b, c] = showcase
  const clauses = headline
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)

  return (
    <section className={styles.heroSection}>
      {/* Soft animated colour blobs + fading architectural dot/grid matrix */}
      <div aria-hidden className={styles.ambientBackdrop}>
        <div className={styles.architecturalGrid} />
        <div className={styles.blobPrimary} />
        <div className={styles.blobSupport} />
        <div className={styles.blobAccent} />
      </div>

      <div className={styles.heroContainer}>
        <div className={styles.heroContent}>
          <m.span
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.35, ease }}
            className={styles.heroBadge}
          >
            <SparklesIcon className={styles.badgeIcon} /> {heroBadge}
          </m.span>

          <m.h1
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.04 }}
            className={styles.heroHeading}
          >
            {clauses.map((clause, idx) => {
              const hasTrailingComma = idx < clauses.length - 1
              const isAccentClause = clauses.length > 1 ? idx === 1 : false
              return (
                <span key={`${idx}-${clause}`} className={styles.headingLine}>
                  {isAccentClause ? (
                    <>
                      <span className={styles.headingAccent}>{clause}</span>
                      {hasTrailingComma ? "," : ""}{" "}
                    </>
                  ) : (
                    <>
                      {clause}
                      {hasTrailingComma ? ", " : ""}
                    </>
                  )}
                </span>
              )
            })}
          </m.h1>

          <m.p
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.08 }}
            className={styles.heroDescription}
          >
            {description}
          </m.p>

          <m.div
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.45, ease, delay: 0.12 }}
            className={styles.ctaRow}
          >
            <Link
              href="/products"
              className={styles.primaryCta}
            >
              <span>Shop the collection</span>
              <ArrowRightIcon className={styles.ctaArrow} />
            </Link>
          </m.div>
        </div>

        {/* Floating product collage with Studio Spotlight Halo */}
        {a && (
          <div className={styles.collageStage}>
            <div aria-hidden className={styles.studioHaloOuter} />
            <div aria-hidden className={styles.studioHaloInner} />
            {[a, b, c].map((p, i) =>
              p ? (
                <div
                  key={p.id}
                  className={collagePositions[i]}
                >
                  <Link
                    href={`/products/${p.slug}`}
                    className={styles.collageCard}
                  >
                    <div className={styles.cardImageWrap}>
                      <ProductImage
                        src={p.images[0]}
                        alt={p.name}
                        sizes="(min-width: 1024px) 280px, 50vw"
                        priority={i === 0}
                        className={styles.cardImage}
                      />
                    </div>
                    <div className={styles.cardFooter}>
                      <span className={styles.cardTitle}>{p.name}</span>
                      <span className={styles.cardPrice}>{formatPrice(p.price)}</span>
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

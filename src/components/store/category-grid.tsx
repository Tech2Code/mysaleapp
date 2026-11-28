import { ArrowUpRightIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Carousel } from "@/components/shared/carousel"
import type { Category } from "@/features/products/types"
import { cn } from "@/lib/utils"
import styles from "./category-grid.module.css"

const tints = [styles.tintAmber, styles.tintSupport, styles.tintWarm] as const

/** Category cards in a swipeable carousel (5 fit on desktop; more scroll). Uses the category photo when there is one. */
export function CategoryGrid({ categories }: { categories: (Category & { count: number })[] }) {
  return (
    <Carousel label="Shop by category">
      {categories.map((c, i) => (
        <li
          key={c.id}
          className={styles.categorySlide}
        >
          <Link
            href={`/category/${c.slug}`}
            className={cn(styles.categoryCard, tints[i % tints.length])}
          >
            {c.imageUrl ? (
              <>
                <Image
                  src={c.imageUrl}
                  alt=""
                  fill
                  loading="lazy"
                  decoding="async"
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 24vw, 44vw"
                  className={styles.categoryPhoto}
                />
                <span aria-hidden className={styles.photoOverlay} />
              </>
            ) : (
              <span className={styles.letterWatermark}>
                {c.name.charAt(0)}
              </span>
            )}
            <ArrowUpRightIcon
              aria-hidden="true"
              className={cn(styles.cornerArrow, Boolean(c.imageUrl) && styles.cornerArrowOnPhoto)}
            />
            <div className={styles.cardTextGroup}>
              <h3 className={cn(styles.categoryTitle, Boolean(c.imageUrl) && styles.categoryTitlePhoto)}>{c.name}</h3>
              <p className={cn(styles.categoryCount, Boolean(c.imageUrl) && styles.categoryCountPhoto)}>
                {c.count} {c.count === 1 ? "item" : "items"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </Carousel>
  )
}

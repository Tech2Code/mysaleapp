import { ArrowUpRightIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Carousel } from "@/components/shared/carousel"
import type { Category } from "@/features/products/types"

const tints = [
  "from-orange-200/70 to-rose-200/60 dark:from-orange-900/40 dark:to-rose-900/30",
  "from-amber-200/70 to-lime-200/50 dark:from-amber-900/40 dark:to-lime-900/30",
  "from-rose-200/70 to-fuchsia-200/50 dark:from-rose-900/40 dark:to-fuchsia-900/30",
  "from-sky-200/60 to-teal-200/50 dark:from-sky-900/40 dark:to-teal-900/30",
  "from-violet-200/60 to-pink-200/50 dark:from-violet-900/40 dark:to-pink-900/30",
]

/** Category cards in a swipeable carousel (5 fit on desktop; more scroll). Uses the category photo when there is one. */
export function CategoryGrid({ categories }: { categories: (Category & { count: number })[] }) {
  return (
    <Carousel label="Shop by category">
      {categories.map((c, i) => (
        <li data-ui="store/CategoryGrid/li"
          key={c.id}
          className="w-[44%] shrink-0 snap-start sm:w-[31%] md:w-[23.5%] lg:w-[calc((100%-4rem)/5)]"
        >
          <Link data-ui="store/CategoryGrid/Link"
            href={`/category/${c.slug}`}
            className={`group relative flex h-44 flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br p-4 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:h-52 sm:p-5 ${tints[i % tints.length]}`}
          >
            {c.imageUrl ? (
              <>
                <Image data-ui="store/CategoryGrid/Image"
                  src={c.imageUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 768px) 24vw, 44vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span data-ui="store/CategoryGrid/span-absolute" aria-hidden className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
              </>
            ) : (
              <span data-ui="store/CategoryGrid/span-absolute-2" className="absolute -right-6 -bottom-8 font-heading text-[7rem] leading-none font-semibold text-foreground/5 transition-transform duration-500 group-hover:scale-110">
                {c.name.charAt(0)}
              </span>
            )}
            <ArrowUpRightIcon
              className={`relative size-5 self-end transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 ${c.imageUrl ? "rounded-full bg-background/90 p-1 text-foreground" : "opacity-60 group-hover:opacity-100"}`}
            />
            <div data-ui="store/CategoryGrid/div-relative" className="relative">
              <h3 data-ui="store/CategoryGrid/h3" className={`text-lg font-semibold sm:text-xl ${c.imageUrl ? "text-white" : ""}`}>{c.name}</h3>
              <p data-ui="store/CategoryGrid/p" className={`text-xs ${c.imageUrl ? "text-white/80" : "text-foreground/60"}`}>
                {c.count} {c.count === 1 ? "item" : "items"}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </Carousel>
  )
}

import { ArrowUpRightIcon } from "lucide-react"
import Link from "next/link"
import { Stagger, StaggerItem } from "@/components/shared/motion"
import type { Category } from "@/features/products/types"

const tints = [
  "from-orange-200/70 to-rose-200/60 dark:from-orange-900/40 dark:to-rose-900/30",
  "from-amber-200/70 to-lime-200/50 dark:from-amber-900/40 dark:to-lime-900/30",
  "from-rose-200/70 to-fuchsia-200/50 dark:from-rose-900/40 dark:to-fuchsia-900/30",
  "from-sky-200/60 to-teal-200/50 dark:from-sky-900/40 dark:to-teal-900/30",
  "from-violet-200/60 to-pink-200/50 dark:from-violet-900/40 dark:to-pink-900/30",
]

export function CategoryGrid({ categories }: { categories: (Category & { count: number })[] }) {
  return (
    <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
      {categories.map((c, i) => (
        <StaggerItem key={c.id}>
          <Link data-ui="store/CategoryGrid/Link"
            href={`/category/${c.slug}`}
            className={`group relative flex h-36 flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br p-5 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:h-44 ${tints[i % tints.length]}`}
          >
            <span data-ui="store/CategoryGrid/span-absolute" className="absolute -right-6 -bottom-8 font-heading text-[7rem] leading-none font-semibold text-foreground/5 transition-transform duration-500 group-hover:scale-110">
              {c.name.charAt(0)}
            </span>
            <ArrowUpRightIcon className="size-5 self-end opacity-60 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            <div data-ui="store/CategoryGrid/div">
              <h3 data-ui="store/CategoryGrid/h3" className="text-lg font-semibold sm:text-xl">{c.name}</h3>
              <p data-ui="store/CategoryGrid/p" className="text-xs text-foreground/60">
                {c.count} {c.count === 1 ? "item" : "items"}
              </p>
            </div>
          </Link>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

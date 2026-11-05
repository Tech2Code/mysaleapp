import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav data-ui="store/Breadcrumbs" aria-label="Breadcrumb">
      <ol data-ui="store/Breadcrumbs/ol-flex" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li data-ui="store/Breadcrumbs/li-flex" key={item.name} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="size-3.5 opacity-60" aria-hidden />}
            {item.href ? (
              <Link data-ui="store/Breadcrumbs/Link" href={item.href} className="inline-block py-1.5 hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span data-ui="store/Breadcrumbs/span" aria-current="page" className="font-medium text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  children,
}: {
  title: string
  description?: string
  breadcrumbs?: { name: string; href?: string }[]
  children?: ReactNode
}) {
  return (
    <section data-ui="store/PageHeader" className="relative overflow-hidden bg-hero">
      <div data-ui="store/PageHeader/div" className="container-page pt-8 pb-6 sm:pt-12 sm:pb-8">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 data-ui="store/PageHeader/h1" className="mt-4 text-4xl font-semibold sm:text-5xl">{title}</h1>
        {description && <p data-ui="store/PageHeader/p" className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">{description}</p>}
        {children}
      </div>
    </section>
  )
}

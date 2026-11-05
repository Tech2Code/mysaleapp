import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav data-ui="store/Breadcrumbs" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="size-3.5 opacity-60" aria-hidden />}
            {item.href ? (
              <Link href={item.href} className="inline-block py-1.5 hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-foreground">
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
      <div className="container-page py-10 sm:py-14">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-muted-foreground sm:text-lg">{description}</p>}
        {children}
      </div>
    </section>
  )
}

import { ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import styles from "./page-header.module.css"

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbNav}>
      <ol className={styles.crumbList}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li

              key={item.name}
              className={isLast ? styles.crumbItemCurrent : styles.crumbItem}
            >
              {i > 0 && <ChevronRightIcon className={styles.crumbSeparator} aria-hidden />}
              {item.href && !isLast ? (
                <Link

                  href={item.href}
                  className={styles.crumbLink}
                >
                  {item.name}
                </Link>
              ) : (
                <span aria-current="page" className={styles.crumbCurrentText}>
                  {item.name}
                </span>
              )}
            </li>
          )
        })}
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
    <section className={styles.pageHeaderSection}>
      <div className={styles.headerContainer}>
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
        {children}
      </div>
    </section>
  )
}

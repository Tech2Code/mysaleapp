"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./pagination.module.css"

type PageItem = number | "ellipsis-start" | "ellipsis-end"

function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const items: PageItem[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push("ellipsis-start")
  for (let p = start; p <= end; p++) items.push(p)
  if (end < total - 1) items.push("ellipsis-end")
  items.push(total)
  return items
}

export interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  itemName?: { singular: string; plural: string }
  onPageChange: (nextPage: number) => void
  className?: string
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemName = { singular: "product", plural: "products" },
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const safeTotalPages = Math.max(1, totalPages)
  const currentPage = Math.min(Math.max(1, page), safeTotalPages)
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(totalItems, currentPage * pageSize)
  const pageItems = buildPageItems(currentPage, safeTotalPages)
  const noun = totalItems === 1 ? itemName.singular : itemName.plural

  return (
    <nav

      aria-label="Pagination"
      className={cn(styles.paginationBar, className)}
    >
      <p className={styles.summaryText} aria-live="polite">
        Showing <span className={styles.summaryStrong}>{from}–{to}</span> of{" "}
        <span className={styles.summaryStrong}>{totalItems}</span> {noun}
      </p>

      <div className={styles.controlsGroup}>
        <button

          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
          className={styles.navBtn}
        >
          <ChevronLeftIcon className={styles.navIcon} aria-hidden="true" />
          <span className={styles.navLabel}>Previous</span>
        </button>

        <div className={styles.pagesList}>
          {pageItems.map((item) => {
            if (item === "ellipsis-start" || item === "ellipsis-end") {
              return (
                <span

                  key={item}
                  aria-hidden="true"
                  className={styles.ellipsisDot}
                >
                  …
                </span>
              )
            }
            const active = item === currentPage
            return (
              <button

                key={item}
                type="button"
                aria-label={`Page ${item}`}
                aria-current={active ? "page" : undefined}
                onClick={() => onPageChange(item)}
                className={cn(styles.pageBtn, active && styles.pageBtnActive)}
              >
                {item}
              </button>
            )
          })}
        </div>

        <button

          type="button"
          disabled={currentPage >= safeTotalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
          className={styles.navBtn}
        >
          <span className={styles.navLabel}>Next</span>
          <ChevronRightIcon className={styles.navIcon} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}


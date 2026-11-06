import type { ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

/**
 * Building blocks for loading skeletons.
 *
 * Rule: a skeleton shows everything that is STATIC for real (titles, headings, table
 * headers, button labels) and shimmers only what comes from the database. It uses the
 * same wrappers/classes as the real page, so there is no layout jump when data arrives.
 */

/** Widths cycle so a list does not look like identical stripes. */
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5"] as const
export const bonewidth = (i: number) => WIDTHS[i % WIDTHS.length]

/** One line of text. */
export function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton data-ui="shared/SkeletonLine" className={cn("h-4 w-full rounded", className)} />
}

/** A paragraph of `lines` lines; the last one is shorter. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div data-ui="shared/SkeletonText" className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 && lines > 1 ? "w-2/3" : undefined} />
      ))}
    </div>
  )
}

/** Label + input, same rhythm as `FieldShell` (label, control, reserved error strip). */
export function SkeletonField({ label, className }: { label?: string; className?: string }) {
  return (
    <div data-ui="shared/SkeletonField" className={cn("space-y-1.5", className)}>
      {label ? <p data-ui="shared/SkeletonField/p" className="text-sm font-medium">{label}</p> : <SkeletonLine className="w-24" />}
      <Skeleton data-ui="shared/SkeletonField/Skeleton" className="h-10 w-full rounded-xl" />
      <div data-ui="shared/SkeletonField/div" className="h-4" />
    </div>
  )
}

/** Card with a real heading and shimmering body. */
export function SkeletonCard({
  title,
  description,
  children,
  className,
}: {
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}) {
  return (
    <section data-ui="shared/SkeletonCard" className={cn("break-inside-avoid rounded-2xl border bg-card p-5 sm:p-6", className)} aria-hidden>
      {title && <h2 data-ui="shared/SkeletonCard/h2" className="font-sans text-lg font-semibold">{title}</h2>}
      {description && <p data-ui="shared/SkeletonCard/p" className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div data-ui="shared/SkeletonCard/div" className={cn(title && "mt-4")}>{children ?? <SkeletonText />}</div>
    </section>
  )
}

/** Real page title/description + shimmering placeholders for the dynamic bits. */
export function PageHeaderSkeleton({
  title,
  description,
  dynamicDescription,
  actions,
}: {
  /** Real text, or a placeholder when the title itself is data (e.g. a product name). */
  title: ReactNode
  description?: string
  /** The description contains a count etc. that is not known yet. */
  dynamicDescription?: boolean
  /** Real buttons, or a placeholder size like "h-10 w-32" via `<ActionBone>`. */
  actions?: ReactNode
}) {
  return (
    <div data-ui="shared/PageHeaderSkeleton" className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div data-ui="shared/PageHeaderSkeleton/div">
        <h1 data-ui="shared/PageHeaderSkeleton/h1" className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? (
          <p data-ui="shared/PageHeaderSkeleton/p" className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : dynamicDescription ? (
          <Skeleton data-ui="shared/PageHeaderSkeleton/Skeleton" className="mt-2 h-4 w-40 rounded" />
        ) : null}
      </div>
      {actions && <div data-ui="shared/PageHeaderSkeleton/div-flex" className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

/** Placeholder for a pill button whose label is unknown (or that is shown conditionally). */
export function ActionBone({ className }: { className?: string }) {
  return <Skeleton data-ui="shared/ActionBone" className={cn("h-10 w-32 rounded-full", className)} />
}

export type SkeletonColumn = {
  /** Real header text (headers are static). */
  label: string
  /** Same responsive/alignment classes the real column uses, e.g. "hidden md:table-cell text-right". */
  className?: string
  /** Shape of the cell content. */
  cell?: "text" | "two-line" | "badge" | "thumb" | "switch" | "number"
  /** Hide the header text from sighted users (action columns). */
  srOnly?: boolean
}

function CellBone({ kind, row }: { kind: NonNullable<SkeletonColumn["cell"]>; row: number }) {
  switch (kind) {
    case "two-line":
      return (
        <div data-ui="shared/CellBone" className="space-y-1.5">
          <Skeleton data-ui="shared/CellBone/Skeleton" className={cn("h-4 rounded", bonewidth(row))} />
          <Skeleton data-ui="shared/CellBone/Skeleton-2" className="h-3 w-1/2 rounded" />
        </div>
      )
    case "badge":
      return <Skeleton data-ui="shared/CellBone" className="h-6 w-20 rounded-full" />
    case "thumb":
      return (
        <div data-ui="shared/CellBone" className="flex items-center gap-3">
          <Skeleton data-ui="shared/CellBone/Skeleton-3" className="size-11 shrink-0 rounded-lg" />
          <Skeleton data-ui="shared/CellBone/Skeleton-4" className={cn("h-4 rounded", bonewidth(row), "min-w-24")} />
        </div>
      )
    case "switch":
      return <Skeleton data-ui="shared/CellBone" className="mx-auto h-5 w-9 rounded-full" />
    case "number":
      return <Skeleton data-ui="shared/CellBone" className="ml-auto h-4 w-14 rounded" />
    default:
      return <Skeleton data-ui="shared/CellBone" className={cn("h-4 rounded", bonewidth(row), "min-w-16")} />
  }
}

/** The real table (same wrapper, header cells and responsive classes), with shimmering rows. */
export function SkeletonTable({ columns, rows = 8 }: { columns: SkeletonColumn[]; rows?: number }) {
  return (
    <div data-ui="shared/SkeletonTable" className="overflow-hidden rounded-2xl border bg-card" aria-hidden>
      <Table data-ui="shared/SkeletonTable/Table">
        <TableHeader data-ui="shared/SkeletonTable/TableHeader">
          <TableRow data-ui="shared/SkeletonTable/TableRow">
            {columns.map((c, i) => (
              <TableHead data-ui="shared/SkeletonTable/TableHead" key={c.label} className={cn(i === 0 && "pl-5", i === columns.length - 1 && "pr-5", c.className)}>
                {c.srOnly ? <span data-ui="shared/SkeletonTable/span" className="sr-only">{c.label}</span> : c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody data-ui="shared/SkeletonTable/TableBody">
          {Array.from({ length: rows }, (_, r) => (
            <TableRow data-ui="shared/SkeletonTable/TableRow-2" key={r}>
              {columns.map((c, i) => (
                <TableCell data-ui="shared/SkeletonTable/TableCell" key={c.label} className={cn(i === 0 && "pl-5", i === columns.length - 1 && "pr-5", c.className)}>
                  <CellBone kind={c.cell ?? "text"} row={r} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** Divided list of rows inside a bordered card (categories, history, etc.). */
export function SkeletonList({ rows = 5, leading = "square" }: { rows?: number; leading?: "square" | "none" }) {
  return (
    <ul data-ui="shared/SkeletonList" className="divide-y overflow-hidden rounded-2xl border bg-card" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li data-ui="shared/SkeletonList/li-flex" key={i} className="flex items-center gap-4 p-4">
          {leading === "square" && <Skeleton data-ui="shared/SkeletonList/Skeleton" className="size-10 shrink-0 rounded-xl" />}
          <div data-ui="shared/SkeletonList/div" className="min-w-0 flex-1 space-y-1.5">
            <Skeleton data-ui="shared/SkeletonList/Skeleton-2" className={cn("h-4 rounded", bonewidth(i))} />
            <Skeleton data-ui="shared/SkeletonList/Skeleton-3" className="h-3 w-1/4 rounded" />
          </div>
          <Skeleton data-ui="shared/SkeletonList/Skeleton-4" className="h-8 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  )
}

import type { ReactNode } from "react"

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <header data-ui="admin/AdminPageHeader" className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div data-ui="admin/AdminPageHeader/div" className="min-w-0">
        {eyebrow && (
          <p data-ui="admin/AdminPageHeader/p" className="mb-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase">{eyebrow}</p>
        )}
        <h1 data-ui="admin/AdminPageHeader/h1" className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-[26px]">
          {title}
        </h1>
        {description && (
          <p data-ui="admin/AdminPageHeader/p-2" className="mt-1 text-xs text-muted-foreground text-pretty sm:text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div data-ui="admin/AdminPageHeader/div-flex" className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      )}
    </header>
  )
}

import type { ReactNode } from "react"

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div data-ui="admin/AdminPageHeader" className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div data-ui="admin/AdminPageHeader/div">
        <h1 data-ui="admin/AdminPageHeader/h1" className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p data-ui="admin/AdminPageHeader/p" className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div data-ui="admin/AdminPageHeader/div-flex" className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type FieldSize = "md" | "lg"

/** Control heights: md = admin panel, lg = storefront (bigger touch targets). */
export const FIELD_HEIGHT: Record<FieldSize, string> = { md: "h-10", lg: "h-11" }

/** Pill-shaped variant used by search bars and filters. */
export const PILL = "h-12 rounded-full px-5"

/** Id of the hint/error paragraph, for aria-describedby. */
export const descriptionId = (id: string) => `${id}-desc`

export const describedBy = (id: string, error?: string, hint?: string) =>
  error || hint ? descriptionId(id) : undefined

/**
 * The shared wrapper every form field uses: label, the control, then an error
 * (announced to screen readers) or a hint. Don't use it directly in pages;
 * build on TextField / TextAreaField / SelectField / SearchField / SwitchField.
 *
 * Layout rule: the error is ABSOLUTELY positioned in a strip reserved under the field (`pb-4`), so showing
 * or hiding an error never moves anything. A field with a hint uses the hint's own space for the error.
 * Because every field already owns that strip, containers around fields use a small gap
 * (`space-y-1.5` / `gap-y-1.5`); use `FIELD_STACK` / `FIELD_GRID` instead of picking a number.
 */
export function FieldShell({
  id,
  label,
  hideLabel,
  error,
  hint,
  className,
  noErrorSpace,
  children,
}: {
  id: string
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
  className?: string
  /** Skip the reserved error strip: for filters/search boxes that never show validation errors. */
  noErrorSpace?: boolean
  children: ReactNode
}) {
  return (
    <div data-ui="form/FieldShell" className={cn("relative space-y-1.5", !hint && !noErrorSpace && "pb-4", className)}>
      <Label htmlFor={id} className={cn("text-sm leading-none font-medium", hideLabel && "sr-only")}>
        {label}
      </Label>
      {children}
      {hint && (
        <p id={error ? undefined : descriptionId(id)} aria-hidden={error ? true : undefined} className={cn("text-[0.6875rem] leading-4 text-muted-foreground", error && "invisible")}>
          {hint}
        </p>
      )}
      {error && (
        <p
          id={descriptionId(id)}
          role="alert"
          title={error}
          className="absolute inset-x-0 bottom-0 text-[0.6875rem] leading-[0.875rem] font-medium text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/** Spacing between stacked fields (each field already reserves its error strip). */
export const FIELD_STACK = "space-y-1.5"
/** Grid of fields: normal column gap, small row gap. */
export const FIELD_GRID = "gap-x-4 gap-y-1.5"

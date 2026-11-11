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
 * Layout rule: the error is ABSOLUTELY positioned right under the input (`top-full`) in a strip reserved below the field (`pb-3`), so showing
 * or hiding an error never moves anything. A field with a hint uses the hint's own space for the error.
 * Because every field already owns that strip, containers around fields use a small gap
 * (`space-y-1` / `gap-y-1`); use `FIELD_STACK` / `FIELD_GRID` instead of picking a number.
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
    <div data-ui="form/FieldShell" className={cn("relative w-full min-w-0 max-w-full", !hint && !noErrorSpace && "pb-3", className)}>
      <Label data-ui="form/FieldShell/Label" htmlFor={id} className={cn("text-sm leading-none font-medium", hideLabel && "sr-only")}>
        {label}
      </Label>
      {/* The error is positioned against THIS box, so it always sits right under the input itself. */}
      <div data-ui="form/FieldShell/div" className={cn("relative w-full min-w-0 max-w-full", !hideLabel && "mt-2")}>
        {children}
        {error && (
          <p data-ui="form/FieldShell/p-absolute"
            id={descriptionId(id)}
            role="alert"
            title={error}
            className="absolute inset-x-0 top-full mt-0.5 text-[0.5625rem]/[0.8125rem] sm:text-[0.625rem]/[0.875rem] font-medium text-destructive tracking-tight"
          >
            {error}
          </p>
        )}
      </div>
      {hint && (
        <p data-ui="form/FieldShell/p"
          id={error ? undefined : descriptionId(id)}
          aria-hidden={error ? true : undefined}
          className={cn("mt-1 text-[0.6875rem]/4 text-muted-foreground", error && "invisible")}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

/** Spacing between stacked fields (each field already reserves its error strip). */
export const FIELD_STACK = "space-y-2"
/** Grid of fields: normal column gap, small row gap. */
export const FIELD_GRID = "gap-x-4 gap-y-1"

import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import styles from "./form.module.css"

export type FieldSize = "md" | "lg"

/** Control heights: md = admin panel, lg = storefront (bigger touch targets). */
export const FIELD_HEIGHT: Record<FieldSize, string> = { md: styles.fieldHeightMd, lg: styles.fieldHeightLg }

/** Pill-shaped variant used by search bars and filters. */
export const PILL = styles.fieldPill

/** Id of the hint/error paragraph, for aria-describedby. */
export const descriptionId = (id: string) => `${id}-desc`

export const describedBy = (id: string, error?: string, hint?: ReactNode) =>
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
  hint?: ReactNode
  className?: string
  /** Skip the reserved error strip: for filters/search boxes that never show validation errors. */
  noErrorSpace?: boolean
  children: ReactNode
}) {
  return (
    <div className={cn(styles.fieldShell, !hint && !noErrorSpace && styles.fieldShellWithSpace, className)}>
      <Label htmlFor={id} className={cn(styles.fieldLabel, hideLabel && styles.srOnly)}>
        {label}
      </Label>
      {/* The error is positioned against THIS box, so it always sits right under the input itself. */}
      <div className={cn(styles.controlBox, !hideLabel && styles.controlBoxSpaced)}>
        {children}
        {error && (
          <p
            id={descriptionId(id)}
            role="alert"
            title={error}
            className={styles.errorAlert}
          >
            {error}
          </p>
        )}
      </div>
      {hint && (
        <p
          id={error ? undefined : descriptionId(id)}
          aria-hidden={error ? true : undefined}
          className={cn(styles.hintText, error && styles.hintInvisible)}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

/** Spacing between stacked fields (each field already reserves its error strip). */
export const FIELD_STACK = styles.fieldStack
/** Grid of fields: normal column gap, small row gap. */
export const FIELD_GRID = styles.fieldGrid

import { cloneElement, isValidElement, useId, type ReactElement } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ControlProps = {
  id?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}

/**
 * Label + control + hint/error, wired up for screen readers
 * (label `for`, `aria-invalid`, `aria-describedby`).
 */
export function FormField({
  label,
  error,
  hint,
  className,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  children: ReactElement<ControlProps>
}) {
  const id = useId()
  const descId = `${id}-desc`
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": error || hint ? descId : undefined,
      })
    : children

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      {control}
      {error ? (
        <p id={descId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

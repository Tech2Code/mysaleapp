"use client"

import { useId, type ComponentProps } from "react"
import { Textarea } from "@/components/ui/textarea"
import { describedBy, FieldShell } from "./field-shell"

export type TextAreaFieldProps = ComponentProps<"textarea"> & {
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
  containerClassName?: string
}

/** Multi-line input with label, hint and error built in. Works with react-hook-form `register`. */
export function TextAreaField({
  label,
  hideLabel,
  error,
  hint,
  containerClassName,
  id: idProp,
  ...props
}: TextAreaFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId

  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} error={error} hint={hint} className={containerClassName}>
      <Textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...props}
      />
    </FieldShell>
  )
}

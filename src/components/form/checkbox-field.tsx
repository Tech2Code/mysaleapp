"use client"

import * as React from "react"
import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import styles from "./form.module.css"

export type CheckboxFieldProps = CheckboxProps & {
  label: React.ReactNode
  description?: React.ReactNode
  error?: string
  containerClassName?: string
  labelClassName?: string
  checkboxClassName?: string
}

/** Accessible checkbox control with label, optional description, and inline error state. */
export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  (
    {
      id: idProp,
      label,
      description,
      error,
      disabled,
      containerClassName,
      labelClassName,
      checkboxClassName,
      className,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId()
    const id = idProp ?? autoId
    const descId = description ? `${id}-desc` : undefined
    const errId = error ? `${id}-err` : undefined
    const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined

    return (
      <div className={cn(styles.checkboxFieldWrap, containerClassName)}>
        <label
          htmlFor={id}
          className={cn(
            styles.checkboxFieldLabel,
            disabled && styles.checkboxFieldLabelDisabled,
            labelClassName
          )}
        >
          <Checkbox
            ref={ref}
            id={id}
            disabled={disabled}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(styles.checkboxFieldControl, checkboxClassName, className)}
            {...props}
          />
          <span className={styles.checkboxFieldTextCol}>
            <span className={styles.checkboxFieldTitle}>{label}</span>
            {description && (
              <span id={descId} className={styles.checkboxFieldDesc}>
                {description}
              </span>
            )}
          </span>
        </label>
        {error && (
          <p id={errId} role="alert" className={styles.checkboxFieldError}>
            {error}
          </p>
        )}
      </div>
    )
  }
)
CheckboxField.displayName = "CheckboxField"


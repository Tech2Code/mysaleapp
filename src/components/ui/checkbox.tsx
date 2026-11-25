"use client"

import * as React from "react"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./ui.module.css"

export type CheckboxProps = Omit<React.ComponentProps<"input">, "type"> & {
  onCheckedChange?: (checked: boolean) => void
  tone?: "default" | "destructive"
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onChange, onCheckedChange, tone = "default", ...props }, ref) => {
    return (
      <span
        data-slot="checkbox"
        data-tone={tone}
        className={cn(styles.checkboxRoot, className)}
      >
        <input
          ref={ref}
          type="checkbox"
          className={styles.checkboxInput}
          onChange={(e) => {
            onChange?.(e)
            onCheckedChange?.(e.target.checked)
          }}
          {...props}
        />
        <span aria-hidden="true" className={styles.checkboxBox}>
          <CheckIcon className={styles.checkboxCheckSvg} />
        </span>
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }


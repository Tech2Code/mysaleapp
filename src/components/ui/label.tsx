"use client"

import * as React from "react"
import { cn } from "cn"
import styles from "./ui.module.css"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(styles.labelBase, className)}
      {...props}
    />
  )
}

export { Label }

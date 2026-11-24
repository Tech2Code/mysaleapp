"use client"

import { CopyButton } from "@/components/shared/copy-button"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

/** A payment reference (UTR, up to 35 characters): always shown in full (wraps if needed) with a copy button when unmasked. */
export function CopyableReference({ value, className }: { value: string; className?: string }) {
  const isMasked = value.includes("*")
  return (
    <span className={styles.copyableRefWrap}>
      <span className={cn(styles.refMonoText, className)}>{value}</span>
      {!isMasked && <CopyButton value={value} label="Reference" variant="icon" />}
    </span>
  )
}

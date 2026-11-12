"use client"

import { CopyButton } from "@/components/shared/copy-button"
import { cn } from "@/lib/utils"

/** A payment reference (UTR, up to 35 characters): always shown in full (wraps if needed) with a copy button when unmasked. */
export function CopyableReference({ value, className }: { value: string; className?: string }) {
  const isMasked = value.includes("*")
  return (
    <span data-ui="shared/CopyableReference" className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 align-middle">
      <span data-ui="shared/CopyableReference/span" className={cn("break-all font-mono", className)}>{value}</span>
      {!isMasked && <CopyButton value={value} label="Reference" variant="icon" />}
    </span>
  )
}

"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** Small "copy" button next to an id. `label` names what is copied, for screen readers and the toast. */
export function CopyButton({
  value,
  label = "Copy",
  variant = "pill",
  className,
}: {
  value: string
  label?: string
  /** "pill" shows the word Copy; "icon" is a compact icon-only button. */
  variant?: "pill" | "icon"
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Couldn't copy. Please select and copy it manually.")
    }
  }

  return (
    <button data-ui="shared/CopyButton"
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-full border bg-card text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        variant === "icon" ? "w-8" : "px-3",
        copied && "border-success/40 text-success",
        className
      )}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {copied ? <CheckIcon className="size-3.5" aria-hidden /> : <CopyIcon className="size-3.5" aria-hidden />}
      {variant === "pill" && (copied ? "Copied" : "Copy")}
    </button>
  )
}

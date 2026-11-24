"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

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
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current)
    },
    []
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success(`${label} copied`)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error("Couldn't copy. Please select and copy it manually.")
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        styles.copyBtn,
        variant === "icon" ? styles.copyBtnIcon : styles.copyBtnPill,
        copied && styles.copyBtnCopied,
        className
      )}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      {copied ? <CheckIcon className={styles.icon14} aria-hidden /> : <CopyIcon className={styles.icon14} aria-hidden />}
      {variant === "pill" && (copied ? "Copied" : "Copy")}
    </button>
  )
}

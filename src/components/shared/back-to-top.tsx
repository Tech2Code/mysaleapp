"use client"

import { ArrowUpIcon } from "lucide-react"
import styles from "./shared.module.css"

/** "Back to top" button for the footer. */
export function BackToTop({ className }: { className?: string }) {
  return (
    <button
      type="button"

      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
      }}
      className={className}
    >
      <ArrowUpIcon className={styles.icon14} aria-hidden /> Back to top
    </button>
  )
}

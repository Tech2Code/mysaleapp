"use client"

import { ArrowUpIcon } from "lucide-react"

/** "Back to top" button for the footer. */
export function BackToTop({ className }: { className?: string }) {
  return (
    <button
      type="button"
      data-ui="shared/BackToTop"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
      }}
      className={className}
    >
      <ArrowUpIcon className="size-3.5" aria-hidden /> Back to top
    </button>
  )
}

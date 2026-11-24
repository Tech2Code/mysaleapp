"use client"

import { useId, useState, type ReactNode } from "react"
import styles from "./shared.module.css"

/**
 * Long text collapsed to a few lines with a fade and a "Read more" button.
 * The full text is always in the page (good for SEO and for screen readers); it is only clipped visually.
 * Short text is shown as is, with no button.
 */
export function ReadMore({
  children,
  collapsedHeight = "9.5rem",
  /** Rough size of the text (characters); below this the text is never clipped. */
  length,
  threshold = 420,
  className,
}: {
  children: ReactNode
  collapsedHeight?: string
  length: number
  threshold?: number
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const collapsible = length > threshold

  return (
    <div className={className}>
      <div
        id={id}
        className={styles.readMoreCollapsible}
        style={collapsible && !open ? { maxHeight: collapsedHeight } : { maxHeight: "200rem" }}
      >
        {children}
        {collapsible && !open && (
          <div aria-hidden className={styles.readMoreFade} />
        )}
      </div>
      {collapsible && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className={styles.readMoreToggleBtn}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}

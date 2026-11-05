"use client"

import { useId, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

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
    <div data-ui="shared/ReadMore" className={className}>
      <div data-ui="shared/ReadMore/div"
        id={id}
        className={cn("relative overflow-hidden transition-[max-height] duration-500 ease-out")}
        style={collapsible && !open ? { maxHeight: collapsedHeight } : { maxHeight: "200rem" }}
      >
        {children}
        {collapsible && !open && (
          <div data-ui="shared/ReadMore/div-absolute" aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent" />
        )}
      </div>
      {collapsible && (
        <button data-ui="shared/ReadMore/button"
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}

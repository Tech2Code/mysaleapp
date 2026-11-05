"use client"

import Link from "next/link"
import type { ComponentProps, MouseEvent } from "react"

/**
 * A normal <Link> that also works when you are already on that page: clicking it scrolls back to the
 * top instead of doing nothing (Next.js does not scroll when the URL doesn't change).
 * Use it for logo, header and footer links.
 */
export function ScrollLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    const target = typeof href === "string" ? href : `${href.pathname ?? ""}${href.search ?? ""}`
    if (target.startsWith("#") || target.includes("#")) return
    const here = window.location.pathname + window.location.search
    const same = target.includes("?") ? target === here : target === window.location.pathname
    if (same) {
      e.preventDefault()
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
    }
  }
  return <Link data-ui="shared/ScrollLink" href={href} onClick={handleClick} {...props} />
}

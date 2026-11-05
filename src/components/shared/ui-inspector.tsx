"use client"

import { CrosshairIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

/**
 * Developer tool (dev builds only). Turn it on with Alt+I or the corner button, hover anything to see its
 * `data-ui` id and ancestors, click to copy the chain, e.g. "store/Header > store/CartButton".
 * Hand that id to whoever changes the UI; `grep -rn 'data-ui="store/Header"' src` finds the file.
 * The ids are added by `npm run ui:tag` and removed from production builds (see next.config.ts).
 */
export function UiInspector() {
  const [on, setOn] = useState(false)
  const [info, setInfo] = useState<{ chain: string; x: number; y: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const lastRef = useRef<Element | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "i") setOn((v) => !v)
      if (e.key === "Escape") setOn(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!on) return
    const target = (e: Event) => (e.target as Element | null)?.closest("[data-ui]") ?? null
    const chainOf = (el: Element) => {
      const ids: string[] = []
      for (let n: Element | null = el; n; n = n.parentElement?.closest("[data-ui]") ?? null) ids.unshift(n.getAttribute("data-ui") ?? "")
      return ids.join("  ›  ")
    }
    const move = (e: MouseEvent) => {
      const el = target(e)
      lastRef.current = el
      const box = boxRef.current
      if (!el || !box) {
        if (box) box.style.display = "none"
        setInfo(null)
        return
      }
      const r = el.getBoundingClientRect()
      Object.assign(box.style, { display: "block", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
      setInfo({ chain: chainOf(el), x: Math.min(e.clientX + 14, window.innerWidth - 340), y: Math.min(e.clientY + 14, window.innerHeight - 70) })
    }
    const click = (e: MouseEvent) => {
      const el = target(e)
      if (!el || (e.target as Element).closest("[data-ui-inspector]")) return
      e.preventDefault()
      e.stopPropagation()
      void navigator.clipboard?.writeText(chainOf(el)).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      })
    }
    document.addEventListener("mousemove", move)
    document.addEventListener("click", click, true)
    return () => {
      document.removeEventListener("mousemove", move)
      document.removeEventListener("click", click, true)
    }
  }, [on])

  if (process.env.NODE_ENV === "production") return null

  return (
    <div data-ui="shared/UiInspector" data-ui-inspector>
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        title="UI ids (Alt+I)"
        className="fixed bottom-4 left-4 z-[200] grid size-9 place-items-center rounded-full bg-foreground/85 text-background opacity-40 shadow-lg transition hover:opacity-100 aria-pressed:bg-primary aria-pressed:opacity-100"
      >
        <CrosshairIcon className="size-4" />
        <span className="sr-only">Toggle UI id inspector</span>
      </button>
      {on && (
        <>
          <div ref={boxRef} className="pointer-events-none fixed z-[199] hidden rounded-sm bg-primary/10 outline-2 outline-primary" />
          {info && (
            <div
              className="pointer-events-none fixed z-[201] max-w-[20rem] rounded-lg bg-foreground px-3 py-2 font-mono text-xs leading-snug break-words text-background shadow-xl"
              style={{ left: info.x, top: info.y }}
            >
              {copied ? "Copied ✓" : info.chain}
            </div>
          )}
        </>
      )}
    </div>
  )
}

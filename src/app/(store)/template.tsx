import type { ReactNode } from "react"

/**
 * Re-mounts on every navigation → gentle page-enter slide. CSS only (no client JS), translate-only so the
 * server-rendered first paint is never transparent (keeps LCP fast), and off for "reduce motion".
 */
export default function StoreTemplate({ children }: { children: ReactNode }) {
  return (
    <div data-ui="page:/(store)/template/div" className="animate-in duration-300 ease-out slide-in-from-bottom-2 motion-reduce:animate-none">
      {children}
    </div>
  )
}

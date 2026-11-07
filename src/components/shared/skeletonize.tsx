import type { ReactNode } from "react"

/**
 * THE way to show a loading state. Render the REAL page/component with placeholder data inside
 * <Skeletonize>; the CSS in `globals.css` ("Skeletons") turns every text run, icon, image and
 * control into a muted block of the same size. The skeleton therefore has the real layout by
 * construction: change the UI and the skeleton changes with it. Never hand-build skeleton markup.
 *
 *   // app/.../loading.tsx
 *   export default function Loading() {
 *     return <Skeletonize><MyPageView {...placeholderMyData()} /></Skeletonize>
 *   }
 *
 * Works in server and client components (pure markup). `display: contents` keeps it out of layout.
 * Not interactive (`inert`), hidden from screen readers (a polite "Loading" status replaces it).
 */
export function Skeletonize({ children, label = "Loading" }: { children: ReactNode; label?: string }) {
  return (
    <div data-ui="shared/Skeletonize" data-skeleton="" aria-busy="true" style={{ display: "contents" }}>
      <span data-ui="shared/Skeletonize/span" role="status" className="sr-only">{label}…</span>
      <div data-ui="shared/Skeletonize/div" aria-hidden inert style={{ display: "contents" }}>
        {children}
      </div>
    </div>
  )
}

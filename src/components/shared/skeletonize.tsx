import type { ReactNode } from "react"
import styles from "./shared.module.css"

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
    <div data-skeleton="" aria-busy="true" className={styles.displayContents}>
      <span role="status" className={styles.srOnly}>{label}…</span>
      <div aria-hidden inert className={styles.displayContents}>
        {children}
      </div>
    </div>
  )
}

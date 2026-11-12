import type { ReactNode } from "react"

/**
 * Store route wrapper. Avoids vertical translate animations on the outer page container so back-button
 * scroll restoration and inner section animations never conflict or jitter.
 */
export default function StoreTemplate({ children }: { children: ReactNode }) {
  return (
    <div data-ui="page:/(store)/template/div">
      {children}
    </div>
  )
}

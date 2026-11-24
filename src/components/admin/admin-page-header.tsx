import type { ReactNode } from "react"
import styles from "./admin-core.module.css"

export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string
  description?: string
  actions?: ReactNode
  eyebrow?: string
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.headerTextCol}>
        {eyebrow && (
          <p className={styles.headerEyebrow}>{eyebrow}</p>
        )}
        <h1 className={styles.headerTitle}>
          {title}
        </h1>
        {description && (
          <p className={styles.headerDesc}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className={styles.headerActionsRow}>
          {actions}
        </div>
      )}
    </header>
  )
}

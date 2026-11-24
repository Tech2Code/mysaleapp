"use client"

import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import styles from "./admin-core.module.css"

/**
 * The one save bar for admin forms. It sticks to the bottom of the screen and spans the WHOLE form,
 * so it is clear that Save applies to every section on the page, not just the column next to it.
 * Put it as the last child of the <form>.
 */
export function StickySaveBar({
  dirty,
  pending,
  busy = false,
  saveLabel = "Save changes",
  onCancel,
  /** Edit forms only enable Save once something changed; create forms are always ready. */
  requireChanges = true,
  className,
}: {
  dirty: boolean
  pending: boolean
  busy?: boolean
  saveLabel?: string
  onCancel?: () => void
  requireChanges?: boolean
  className?: string
}) {
  const unsaved = dirty

  return (
    <div
      data-slot="sticky-save-bar"
      className={cn(
        "adminCard",
        styles.stickySaveBar,
        className
      )}
    >
      <p className={styles.saveStatusText} aria-live="polite">
        <span className={cn(styles.statusDot, unsaved ? styles.dotAmber : styles.dotEmerald)} aria-hidden />
        {unsaved ? "You have unsaved changes" : requireChanges ? "All changes saved" : "Review the details, then save"}
      </p>
      <div className={styles.saveActionsGroup}>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel} className={styles.cancelBtn}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={pending || busy || (requireChanges && !dirty)} className={styles.saveBtn}>
          {pending && <Loader2Icon className={styles.spinIcon} />} {saveLabel}
        </Button>
      </div>
    </div>
  )
}

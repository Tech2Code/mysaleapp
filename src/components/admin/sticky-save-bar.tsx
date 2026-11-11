"use client"

import { Loader2Icon } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

  // Closing / reloading the tab with edits that were never saved: let the browser ask first.
  useEffect(() => {
    if (!unsaved || pending) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [unsaved, pending])

  return (
    <div data-ui="admin/StickySaveBar"
      className={cn(
        "sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:px-4",
        className
      )}
    >
      <p data-ui="admin/StickySaveBar/p-flex" className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
        <span data-ui="admin/StickySaveBar/span" className={cn("size-2 rounded-full", unsaved ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
        {unsaved ? "You have unsaved changes" : requireChanges ? "All changes saved" : "Review the details, then save"}
      </p>
      <div data-ui="admin/StickySaveBar/div-flex" className="ml-auto flex items-center gap-2">
        {onCancel && (
          <Button data-ui="admin/StickySaveBar/Button-cancel" type="button" variant="outline" disabled={pending} onClick={onCancel} className="rounded-full">
            Cancel
          </Button>
        )}
        <Button data-ui="admin/StickySaveBar/Button" type="submit" disabled={pending || busy || (requireChanges && !dirty)} className="rounded-full px-6">
          {pending && <Loader2Icon className="animate-spin" />} {saveLabel}
        </Button>
      </div>
    </div>
  )
}

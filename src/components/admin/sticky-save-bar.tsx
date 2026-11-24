"use client"

import { Loader2Icon } from "lucide-react"
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

  return (
    <div data-ui="admin/StickySaveBar"
      className={cn(
        "adminCard sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 shadow-lg backdrop-blur sm:px-4 lg:bottom-4",
        className
      )}
    >
      <p data-ui="admin/StickySaveBar/p-flex" className="flex items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm" aria-live="polite">
        <span data-ui="admin/StickySaveBar/span" className={cn("size-2 rounded-full", unsaved ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
        {unsaved ? "You have unsaved changes" : requireChanges ? "All changes saved" : "Review the details, then save"}
      </p>
      <div data-ui="admin/StickySaveBar/div-flex" className="ml-auto flex items-center gap-2">
        {onCancel && (
          <Button data-ui="admin/StickySaveBar/Button-cancel" type="button" variant="outline" size="sm" disabled={pending} onClick={onCancel} className="h-9 rounded-lg px-4">
            Cancel
          </Button>
        )}
        <Button data-ui="admin/StickySaveBar/Button" type="submit" size="sm" disabled={pending || busy || (requireChanges && !dirty)} className="h-9 rounded-lg px-5">
          {pending && <Loader2Icon className="animate-spin" />} {saveLabel}
        </Button>
      </div>
    </div>
  )
}

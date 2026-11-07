"use client"

import type { ReactNode } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * THE "are you sure?" step. Every click that changes data and is hard to undo (cancel, delete, refund,
 * verify / reject payment, status change, sign out) opens this first, so a mis-click never acts.
 * Controlled: the caller owns `open` and runs the action in `onConfirm`; close the dialog there (or when
 * `pending` ends). Esc / outside click / Cancel just close it. Focus moves into the dialog and returns on close.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  pending?: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent data-ui="shared/ConfirmDialog/DialogContent">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button data-ui="shared/ConfirmDialog/Button" type="button" variant="outline" className="rounded-full" disabled={pending} />}>
            {cancelLabel}
          </DialogClose>
          <Button data-ui="shared/ConfirmDialog/Button-2" type="button" variant={destructive ? "destructive" : "default"} className="rounded-full" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2Icon className="animate-spin" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type { ReactNode } from "react"
import { CheckIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
      <DialogContent data-ui="shared/ConfirmDialog/DialogContent" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <DialogBody>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </DialogDescription>
          </DialogBody>
        )}
        <DialogFooter>
          <DialogClose render={<Button data-ui="shared/ConfirmDialog/Button" type="button" variant="outline" className="gap-1.5 rounded-full" disabled={pending} />}>
            <XIcon className="size-4" /> {cancelLabel}
          </DialogClose>
          <Button data-ui="shared/ConfirmDialog/Button-2" type="button" variant={destructive ? "destructive" : "default"} className="gap-1.5 rounded-full" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2Icon className="animate-spin" /> : destructive ? <Trash2Icon className="size-4" /> : <CheckIcon className="size-4" />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type { ReactNode } from "react"
import { CheckIcon, Loader2Icon, Trash2Icon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import styles from "./shared.module.css"

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
      <DialogContent showCloseButton={!pending} className={styles.confirmDialogMax}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <DialogBody>
            <DialogDescription className={styles.confirmDescText}>
              {description}
            </DialogDescription>
          </DialogBody>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" className={styles.confirmPillBtn} disabled={pending} />}>
            <XIcon className={styles.icon16} /> {cancelLabel}
          </DialogClose>
          <Button type="button" variant={destructive ? "destructive" : "default"} className={styles.confirmPillBtn} disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2Icon className={styles.icon16Spin} /> : destructive ? <Trash2Icon className={styles.icon16} /> : <CheckIcon className={styles.icon16} />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

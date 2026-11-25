"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, XIcon } from "lucide-react"
import styles from "./ui.module.css"

type DialogContextValue = {
  onBackStep?: () => boolean
  closeDialog: () => void
}

const DialogContext = React.createContext<DialogContextValue>({
  closeDialog: () => {},
})

const DialogMobileFullScreenContext = React.createContext(false)

/**
 * Shared history stack for modal overlays (Dialogs & Sheets) so pressing the mobile hardware/gesture
 * Back button dismisses the topmost open popup (or steps back inside a multi-step dialog) instead of
 * navigating the browser route backward by 1–2 pages.
 */
type OverlayHistoryEntry = {
  id: string
  close: () => void
  onBack?: () => boolean
}

const overlayStack: OverlayHistoryEntry[] = []
let ignorePopCount = 0
let popListenerAttached = false

function ensureOverlayPopListener() {
  if (popListenerAttached || typeof window === "undefined") return
  popListenerAttached = true

  // Register in capture phase so we intercept mobile Back BEFORE Next.js App Router's popstate listener
  window.addEventListener(
    "popstate",
    (e: PopStateEvent) => {
      if (ignorePopCount > 0) {
        ignorePopCount--
        e.stopImmediatePropagation()
        return
      }
      const top = overlayStack[overlayStack.length - 1]
      if (!top) return

      // Intercept this back press for the topmost open overlay
      e.stopImmediatePropagation()
      if (top.onBack && top.onBack()) {
        // Handled as an internal step-back inside the dialog; re-push the guard entry so the dialog stays protected
        try {
          const prevState =
            window.history.state && typeof window.history.state === "object" ? window.history.state : {}
          window.history.pushState({ ...prevState, __overlayId: top.id }, "")
        } catch {}
        return
      }

      overlayStack.pop()
      top.close()
    },
    true
  )
}

export function useOverlayHistory(
  open: boolean,
  onClose: () => void,
  onBackStep?: () => boolean
) {
  const id = React.useId()
  const onCloseRef = React.useRef(onClose)
  const onBackStepRef = React.useRef(onBackStep)

  React.useEffect(() => {
    onCloseRef.current = onClose
    onBackStepRef.current = onBackStep
  }, [onClose, onBackStep])

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return
    ensureOverlayPopListener()

    const entry: OverlayHistoryEntry = {
      id,
      close: () => onCloseRef.current(),
      onBack: () => (onBackStepRef.current ? onBackStepRef.current() : false),
    }
    overlayStack.push(entry)
    const pushedUrl = window.location.pathname + window.location.search

    try {
      const prevState =
        window.history.state && typeof window.history.state === "object" ? window.history.state : {}
      window.history.pushState({ ...prevState, __overlayId: id }, "")
    } catch {}

    return () => {
      const idx = overlayStack.indexOf(entry)
      if (idx !== -1) {
        overlayStack.splice(idx, 1)
        const currentUrl = window.location.pathname + window.location.search
        // Only pop the synthetic history entry if the user closed the dialog via UI while still on the same URL
        if (currentUrl === pushedUrl && window.history.state?.__overlayId === id) {
          ignorePopCount++
          try {
            window.history.back()
          } catch {
            ignorePopCount = Math.max(0, ignorePopCount - 1)
          }
        }
      }
    }
  }, [open, id])
}

function Dialog({
  open: openProp,
  defaultOpen,
  onOpenChange,
  onBackStep,
  ...props
}: DialogPrimitive.Root.Props & {
  /** Optional handler for multi-step dialogs: return `true` if a mobile Back press stepped back internally instead of closing. */
  onBackStep?: () => boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen

  const handleOpenChange = React.useCallback<NonNullable<DialogPrimitive.Root.Props["onOpenChange"]>>(
    (nextOpen, eventDetails) => {
      if (!isControlled) setUncontrolledOpen(nextOpen)
      onOpenChange?.(nextOpen, eventDetails)
    },
    [isControlled, onOpenChange]
  )

  const closeDialog = React.useCallback(() => {
    if (!isControlled) setUncontrolledOpen(false)
    ;(onOpenChange as ((next: boolean) => void) | undefined)?.(false)
  }, [isControlled, onOpenChange])

  useOverlayHistory(open, closeDialog, onBackStep)

  const ctxValue = React.useMemo(
    () => ({ onBackStep, closeDialog }),
    [onBackStep, closeDialog]
  )

  return (
    <DialogContext.Provider value={ctxValue}>
      <DialogPrimitive.Root data-slot="dialog" open={open} onOpenChange={handleOpenChange} {...props} />
    </DialogContext.Provider>
  )
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(styles.dialogOverlay, className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = false,
  mobileFullScreen = false,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
  mobileFullScreen?: boolean
}) {
  return (
    <DialogMobileFullScreenContext.Provider value={mobileFullScreen}>
      <DialogPortal>
        <DialogOverlay className={mobileFullScreen ? styles.dialogOverlayFullScreenMobile : undefined} />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-mobile-fullscreen={mobileFullScreen ? "true" : undefined}
          className={cn(
            styles.dialogPopup,
            mobileFullScreen ? styles.dialogPopupMobileFull : styles.dialogPopupStandard,
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="dialog-close"
              render={
                <Button
                  type="button"
                  variant="ghost"
                  className={styles.cornerCloseBtn}
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className={styles.srOnly}>Close</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </DialogMobileFullScreenContext.Provider>
  )
}

function DialogHeader({
  className,
  showCloseButton = true,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const mobileFullScreen = React.useContext(DialogMobileFullScreenContext)
  const { onBackStep, closeDialog } = React.useContext(DialogContext)
  const childArray = React.Children.toArray(children)
  const firstChild = childArray[0] ?? null
  const restChildren = childArray.slice(1)

  const handleMobileBack = () => {
    if (onBackStep && onBackStep()) return
    closeDialog()
  }

  return (
    <div
      data-slot="dialog-header"
      className={cn(
        styles.dialogHeader,
        mobileFullScreen && styles.dialogHeaderMobileFull,
        className
      )}
      {...props}
    >
      <div className={styles.dialogHeaderTopRow}>
        {mobileFullScreen && showCloseButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            data-slot="dialog-back"
            aria-label="Back"
            onClick={handleMobileBack}
            className={styles.mobileBackBtn}
          >
            <ArrowLeftIcon className={styles.icon18} />
            <span className={styles.srOnly}>Back</span>
          </Button>
        )}
        <div className={styles.headerTitleCol}>{firstChild}</div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  styles.headerCloseBtn,
                  mobileFullScreen && styles.headerCloseHiddenMobile
                )}
              />
            }
          >
            <XIcon className={styles.icon16} />
            <span className={styles.srOnly}>Close</span>
          </DialogPrimitive.Close>
        )}
      </div>
      {restChildren}
    </div>
  )
}

function DialogBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const mobileFullScreen = React.useContext(DialogMobileFullScreenContext)
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        styles.dialogBody,
        mobileFullScreen && styles.dialogBodyMobileFull,
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const mobileFullScreen = React.useContext(DialogMobileFullScreenContext)
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        styles.dialogFooter,
        mobileFullScreen && styles.dialogFooterMobileFull,
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button type="button" variant="outline" className={styles.pillOutlineBtn} />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(styles.dialogTitle, className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(styles.dialogDescription, className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

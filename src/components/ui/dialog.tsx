"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, XIcon } from "lucide-react"
import styles from "./ui.module.css"

const DialogMobileFullScreenContext = React.createContext(false)

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
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
      {mobileFullScreen && showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-back"
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Back"
              className={styles.mobileBackBtn}
            />
          }
        >
          <ArrowLeftIcon className={styles.icon20} />
          <span className={styles.srOnly}>Back</span>
        </DialogPrimitive.Close>
      )}
      <div className={styles.headerTitleCol}>{children}</div>
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

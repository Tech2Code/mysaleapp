"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, XIcon } from "lucide-react"

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
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/40 duration-200 ease-out supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
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
        <DialogOverlay className={mobileFullScreen ? "max-sm:bg-background" : undefined} />
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          data-mobile-fullscreen={mobileFullScreen ? "true" : undefined}
          className={cn(
            "fixed z-50 flex flex-col w-full bg-popover text-sm text-popover-foreground duration-200 ease-out will-change-[transform,opacity] outline-none overflow-hidden data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            mobileFullScreen
              ? "inset-0 h-dvh max-h-dvh max-w-none translate-0 rounded-none border-0 shadow-none ring-0 max-sm:data-open:slide-in-from-bottom-4 max-sm:data-closed:slide-out-to-bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[min(90dvh,850px)] sm:max-w-sm sm:-translate-1/2 sm:rounded-2xl sm:shadow-2xl sm:ring-1 sm:ring-foreground/10 sm:data-open:zoom-in-95 sm:data-closed:zoom-out-95"
              : "top-1/2 left-1/2 max-w-[calc(100%-2rem)] -translate-1/2 rounded-2xl shadow-2xl ring-1 ring-foreground/10 sm:max-w-sm max-h-[min(90dvh,850px)] data-open:zoom-in-95 data-closed:zoom-out-95",
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
                  className="absolute top-2 right-2"
                  size="icon-sm"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
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
        "flex shrink-0 items-start justify-between gap-3 border-b bg-muted/30 px-5 py-4",
        mobileFullScreen && "max-sm:bg-card max-sm:px-4 max-sm:py-3.5",
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
              className="-ml-1.5 -mt-0.5 size-8 shrink-0 rounded-full text-foreground hover:bg-muted sm:hidden"
            />
          }
        >
          <ArrowLeftIcon className="size-5" />
          <span className="sr-only">Back</span>
        </DialogPrimitive.Close>
      )}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">{children}</div>
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "-mr-1 -mt-0.5 size-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
                mobileFullScreen && "max-sm:hidden"
              )}
            />
          }
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
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
        "flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4",
        mobileFullScreen && "max-sm:p-4",
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
        "flex shrink-0 flex-col-reverse gap-2.5 border-t bg-muted/40 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end mt-auto",
        mobileFullScreen && "max-sm:bg-card max-sm:px-4 max-sm:pb-[max(0.875rem,env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button type="button" variant="outline" className="rounded-full" />}>
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
      className={cn(
        "font-heading text-base/snug sm:text-lg font-semibold",
        className
      )}
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
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
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

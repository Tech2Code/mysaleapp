"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import styles from "./ui.module.css"

const Toaster = ({
  position = "top-right",
  offset = {
    top: "calc(var(--app-header-h, var(--store-header-h, 64px)) + 12px)",
    right: "16px",
  },
  mobileOffset = {
    top: "calc(var(--app-header-h, var(--store-header-h, 64px)) + 8px)",
    left: "16px",
    right: "16px",
  },
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={cn("toaster", styles.sonnerToaster)}
      position={position}
      offset={offset}
      mobileOffset={mobileOffset}
      icons={{
        success: (
          <span aria-hidden="true" className={styles.toastSuccessBadge}>
            <svg viewBox="0 0 20 20" fill="none" className={styles.toastSuccessSvg}>
              <path
                d="M5.8 10.4L8.6 13.2L14.2 7.2"
                pathLength={1}
                className={styles.toastSuccessCheck}
              />
            </svg>
          </span>
        ),
        info: (
          <InfoIcon className={styles.toastIconInfo} />
        ),
        warning: (
          <TriangleAlertIcon className={styles.toastIconWarning} />
        ),
        error: (
          <OctagonXIcon className={styles.toastIconError} />
        ),
        loading: (
          <Loader2Icon className={styles.toastIconLoading} />
        ),
      }}
      toastOptions={{
        classNames: {
          toast: styles.toastBox,
          title: styles.toastTitle,
          description: styles.toastDescription,
          closeButton: styles.toastCloseBtn,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"
import styles from "./ui.module.css"

const Toaster = ({
  position = "top-right",
  offset = {
    top: "calc(var(--app-header-h, var(--store-header-h, 4rem)) + 12px)",
    right: "16px",
  },
  mobileOffset = {
    top: "calc(var(--app-header-h, var(--store-header-h, 4rem)) + 8px)",
    left: "16px",
    right: "16px",
  },
  ...props
}: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster"
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
      style={
        {
          "--normal-bg": "oklch(0.21 0.02 45 / 96%)",
          "--normal-text": "oklch(0.98 0.005 80)",
          "--normal-border": "oklch(1 0 0 / 16%)",
          "--success-bg": "oklch(0.23 0.045 155 / 96%)",
          "--success-text": "oklch(0.98 0.01 155)",
          "--success-border": "oklch(0.68 0.17 155 / 50%)",
          "--error-bg": "oklch(0.24 0.075 25 / 96%)",
          "--error-text": "oklch(0.98 0.01 25)",
          "--error-border": "oklch(0.66 0.2 25 / 55%)",
          "--warning-bg": "oklch(0.25 0.06 75 / 96%)",
          "--warning-text": "oklch(0.98 0.01 80)",
          "--warning-border": "oklch(0.76 0.16 75 / 50%)",
          "--info-bg": "oklch(0.23 0.04 240 / 96%)",
          "--info-text": "oklch(0.98 0.01 240)",
          "--info-border": "oklch(0.7 0.14 240 / 50%)",
          "--border-radius": "1rem",
        } as React.CSSProperties
      }
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

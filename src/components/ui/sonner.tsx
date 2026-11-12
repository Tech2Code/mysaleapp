"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

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
      className="toaster group"
      position={position}
      offset={offset}
      mobileOffset={mobileOffset}
      icons={{
        success: (
          <CircleCheckIcon className="size-5 text-emerald-400 shrink-0" />
        ),
        info: (
          <InfoIcon className="size-5 text-sky-400 shrink-0" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5 text-amber-400 shrink-0" />
        ),
        error: (
          <OctagonXIcon className="size-5 text-rose-400 shrink-0" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin text-primary shrink-0" />
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
          toast:
            "cn-toast !rounded-2xl !border !px-4 !py-3.5 !shadow-[0_20px_45px_-10px_rgb(0_0_0/0.4),0_8px_18px_-6px_rgb(0_0_0/0.25)] !backdrop-blur-xl !gap-3",
          title: "!text-sm !font-semibold !leading-snug",
          description: "!text-xs !opacity-85",
          closeButton:
            "!bg-neutral-800 !text-white !border-white/20 hover:!bg-neutral-700",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

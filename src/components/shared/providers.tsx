"use client"

import { UiInspector } from "./ui-inspector"
import { MotionConfig } from "motion/react"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { AuthListener } from "./auth-listener"
import { BusyOverlayProvider } from "./busy-overlay"
import { RouteProgressProvider } from "./route-progress"
import { ServiceWorkerRegister } from "./sw-register"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* Honour the OS "reduce motion" setting for every animation in the app */}
      <MotionConfig reducedMotion="user">
        <RouteProgressProvider>
          <BusyOverlayProvider>{children}</BusyOverlayProvider>
        </RouteProgressProvider>
        <Toaster position="top-center" richColors closeButton />
        <AuthListener />
        <ServiceWorkerRegister />
        <UiInspector />
      </MotionConfig>
    </ThemeProvider>
  )
}

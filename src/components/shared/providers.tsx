"use client"

import { UiInspector } from "./ui-inspector"
import { LazyMotion, MotionConfig } from "motion/react"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { AuthListener } from "./auth-listener"
import { BusyOverlayProvider } from "./busy-overlay"
import { RouteProgressProvider } from "./route-progress"
import { ServiceWorkerRegister } from "./sw-register"

// Feature set (incl. layout animations), fetched as its own chunk after hydration. `m.*` components render fine before it arrives.
const loadMotionFeatures = () => import("./motion-features").then((mod) => mod.default)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* Honour the OS "reduce motion" setting for every animation in the app */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadMotionFeatures}>
          <RouteProgressProvider>
            <BusyOverlayProvider>{children}</BusyOverlayProvider>
          </RouteProgressProvider>
          <Toaster position="top-right" richColors closeButton />
          <AuthListener />
          <ServiceWorkerRegister />
          <UiInspector />
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  )
}

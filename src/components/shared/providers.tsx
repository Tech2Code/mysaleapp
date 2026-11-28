"use client"

import { LazyMotion, MotionConfig } from "motion/react"
import { ThemeProvider } from "next-themes"
import { Suspense, type ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { ScrollReset } from "./scroll-reset"
import { AuthListener } from "./auth-listener"
import { BusyOverlayProvider } from "./busy-overlay"
import { RouteProgressProvider } from "./route-progress"
import { ServiceWorkerRegister } from "./sw-register"

const loadMotionFeatures = () => import("./motion-features").then((m) => m.default)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* Honour the OS "reduce motion" setting for every animation in the app */}
      <MotionConfig reducedMotion="user">
        <LazyMotion features={loadMotionFeatures} strict>
          <RouteProgressProvider>
            <BusyOverlayProvider>{children}</BusyOverlayProvider>
          </RouteProgressProvider>
          <Toaster position="top-right" richColors closeButton />
          <Suspense fallback={null}>
            <ScrollReset />
          </Suspense>
          <AuthListener />
          <ServiceWorkerRegister />
        </LazyMotion>
      </MotionConfig>
    </ThemeProvider>
  )
}

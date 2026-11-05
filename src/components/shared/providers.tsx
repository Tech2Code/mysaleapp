"use client"

import { MotionConfig } from "motion/react"
import { ThemeProvider } from "next-themes"
import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { AuthListener } from "./auth-listener"
import { ServiceWorkerRegister } from "./sw-register"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {/* Honour the OS "reduce motion" setting for every animation in the app */}
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <AuthListener />
        <ServiceWorkerRegister />
      </MotionConfig>
    </ThemeProvider>
  )
}

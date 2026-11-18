"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button data-ui="shared/ThemeToggle"
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
    >
      <SunIcon className="size-4.6 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
      <MoonIcon className="absolute size-4.6 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
    </Button>
  )
}

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "Auto", icon: MonitorIcon },
] as const

export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const current = mounted ? (theme ?? "system") : "system"

  return (
    <div
      data-ui="shared/ThemeSegmentedControl"
      role="group"
      aria-label="Theme preference"
      className={cn("grid grid-cols-3 gap-1 rounded-xl border border-border/70 bg-muted/50 p-1", className)}
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = current === opt.value
        return (
          <button
            data-ui="shared/ThemeSegmentedControl/button"
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors",
              active
                ? "bg-background font-semibold text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span data-ui="shared/ThemeSegmentedControl/span">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ThemeSettingSection({ className }: { className?: string }) {
  return (
    <div
      data-ui="shared/ThemeSettingSection"
      className={cn("flex flex-col gap-3 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6", className)}
    >
      <div data-ui="shared/ThemeSettingSection/div" className="space-y-0.5">
        <h3 data-ui="shared/ThemeSettingSection/h3-appearance" className="font-sans text-base font-semibold">Appearance</h3>
        <p data-ui="shared/ThemeSettingSection/p" className="text-xs text-muted-foreground">Choose Light, Dark, or follow your device setting.</p>
      </div>
      <ThemeSegmentedControl className="w-full sm:w-64" />
    </div>
  )
}

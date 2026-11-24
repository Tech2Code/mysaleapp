"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import styles from "./shared.module.css"

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(styles.themeToggleBtn, className)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle dark mode"
    >
      <SunIcon className={styles.sunSvg} />
      <MoonIcon className={styles.moonSvg} />
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

      role="group"
      aria-label="Theme preference"
      className={cn(styles.themeSegmentedGroup, className)}
    >
      {THEME_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = current === opt.value
        return (
          <button

            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className={cn(
              styles.segmentBtn,
              active && styles.segmentBtnActive
            )}
          >
            <Icon className={styles.icon14} aria-hidden />
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function ThemeSettingSection({ className }: { className?: string }) {
  return (
    <div

      className={cn(styles.themeSettingCard, className)}
    >
      <div className={styles.settingTextCol}>
        <h3 className={styles.settingTitle}>Appearance</h3>
        <p className={styles.settingDesc}>Choose Light, Dark, or follow your device setting.</p>
      </div>
      <ThemeSegmentedControl className={styles.segmentedWidth} />
    </div>
  )
}

"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { SegmentedTabs } from "./segmented-tabs"
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
      <SunIcon className={styles.sunSvg} aria-hidden="true" />
      <MoonIcon className={styles.moonSvg} aria-hidden="true" />
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
    <SegmentedTabs
      layout="equal"
      size="sm"
      ariaLabel="Theme preference"
      value={current}
      onChange={setTheme}
      items={THEME_OPTIONS}
      className={className}
    />
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

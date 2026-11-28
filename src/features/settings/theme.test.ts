import { describe, expect, it } from "vitest"
import {
  DEFAULT_CUSTOM_THEME,
  THEME_PRESETS,
  bestTextOn,
  buildCustomThemeCss,
  contrastRatio,
  deriveCustomThemeTokens,
  isThemePresetId,
  parseCustomTheme,
  resolveThemeBrandPalette,
} from "./theme"

describe("unified theme system", () => {
  it("ships 8 curated presets that all pass WCAG AA contrast in light mode", () => {
    expect(THEME_PRESETS).toHaveLength(8)
    for (const preset of THEME_PRESETS) {
      const btnContrast = contrastRatio(preset.light.primary, preset.light.primaryFg)
      const textContrast = contrastRatio(preset.light.fg, preset.light.bg)
      expect(btnContrast, `${preset.id} primary button contrast`).toBeGreaterThanOrEqual(4.5)
      expect(textContrast, `${preset.id} body text contrast`).toBeGreaterThanOrEqual(7)
    }
  })

  it("validates theme preset ids and rejects unknown values", () => {
    expect(isThemePresetId("terracotta")).toBe(true)
    expect(isThemePresetId("custom")).toBe(true)
    expect(isThemePresetId("neon-hacker")).toBe(false)
    expect(isThemePresetId(null)).toBe(false)
  })

  it("strictly validates 6-digit hex codes in parseCustomTheme to prevent CSS injection", () => {
    expect(parseCustomTheme({ primary: "#b84a27", background: "#faf8f5", foreground: "#231b17" })).toEqual({
      primary: "#B84A27",
      background: "#FAF8F5",
      foreground: "#231B17",
    })
    expect(parseCustomTheme({ primary: "#B84A27; } body { display: none", background: "#FFFFFF", foreground: "#111111" })).toBeNull()
    expect(parseCustomTheme({ primary: "red", background: "#FFFFFF", foreground: "#111111" })).toBeNull()
    expect(parseCustomTheme(null)).toBeNull()
  })

  it("picks accessible foreground text via bestTextOn and generates both light and dark CSS blocks", () => {
    expect(bestTextOn("#18181B")).toBe("#FFFFFF")
    expect(bestTextOn("#FAF8F5")).toBe("#111111")

    const tokens = deriveCustomThemeTokens(DEFAULT_CUSTOM_THEME)
    expect(tokens.textContrast).toBeGreaterThanOrEqual(10)
    expect(tokens.primaryContrast).toBeGreaterThanOrEqual(4.5)

    const css = buildCustomThemeCss(DEFAULT_CUSTOM_THEME)
    expect(css).toContain(':root[data-theme="custom"]')
    expect(css).toContain('.dark[data-theme="custom"]')
    expect(css).toContain("--primary: #B84A27;")
  })

  it("derives themed favicon/PWA brand palettes with cache-busting version keys", () => {
    const emerald = resolveThemeBrandPalette("emerald", null)
    expect(emerald.themeColor).toBe("#156847")
    expect(emerald.versionKey).toBe("emerald")
    expect(emerald.gradient).toContain("#156847")

    const custom = resolveThemeBrandPalette("custom", { primary: "#7C3AED", background: "#FAF5FF", foreground: "#1E1033" })
    expect(custom.themeColor).toBe("#7C3AED")
    expect(custom.versionKey).toBe("custom-7c3aed-faf5ff")
  })
})

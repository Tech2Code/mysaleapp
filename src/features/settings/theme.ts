export const PRESET_THEME_IDS = [
  "terracotta",
  "vermilion",
  "emerald",
  "indigo",
  "teal",
  "burgundy",
  "cobalt",
  "charcoal",
] as const

export const THEME_PRESET_IDS = [...PRESET_THEME_IDS, "custom"] as const

export type PresetThemeId = (typeof PRESET_THEME_IDS)[number]
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number]

export type CustomThemeColors = {
  primary: string
  background: string
  foreground: string
}

export type ThemePresetMeta = {
  id: PresetThemeId
  name: string
  tagline: string
  contrast: string
  recommended?: boolean
  light: {
    bg: string
    surface: string
    card: string
    fg: string
    muted: string
    primary: string
    primaryFg: string
    badgeBg: string
    badgeFg: string
  }
  dark: {
    bg: string
    surface: string
    card: string
    fg: string
    muted: string
    primary: string
    primaryFg: string
    badgeBg: string
    badgeFg: string
  }
}

export const DEFAULT_THEME_PRESET: ThemePresetId = "terracotta"

export const DEFAULT_CUSTOM_THEME: CustomThemeColors = {
  primary: "#B84A27",
  background: "#FAF8F5",
  foreground: "#231B17",
}

export const THEME_PRESETS: readonly ThemePresetMeta[] = [
  {
    id: "terracotta",
    name: "Artisanal Terracotta",
    tagline: "Warm handcrafted luxury — matches logo",
    contrast: "5.1:1 AA",
    recommended: true,
    light: { bg: "#FAF8F5", surface: "#F2EDE6", card: "#FFFFFF", fg: "#231B17", muted: "#665850", primary: "#B84A27", primaryFg: "#FFFFFF", badgeBg: "#FCECE6", badgeFg: "#9A391B" },
    dark: { bg: "#14110F", surface: "#26201C", card: "#1E1916", fg: "#F6F1EB", muted: "#B0A298", primary: "#E06D47", primaryFg: "#14110F", badgeBg: "rgba(224,109,71,0.18)", badgeFg: "#F59C7D" },
  },
  {
    id: "vermilion",
    name: "Obsidian & Vermilion",
    tagline: "Crisp modern D2C — high-conversion editorial",
    contrast: "4.9:1 AA",
    light: { bg: "#FFFFFF", surface: "#F4F6F9", card: "#FFFFFF", fg: "#111827", muted: "#4B5563", primary: "#D63B2F", primaryFg: "#FFFFFF", badgeBg: "#FEECEB", badgeFg: "#B22B21" },
    dark: { bg: "#0B0F17", surface: "#1B2332", card: "#131924", fg: "#F3F6FA", muted: "#9CA8BA", primary: "#E64F43", primaryFg: "#FFFFFF", badgeBg: "rgba(230,79,67,0.18)", badgeFg: "#FF9087" },
  },
  {
    id: "emerald",
    name: "Forest Emerald",
    tagline: "Organic luxury — Aesop & Shopify inspired",
    contrast: "6.8:1 AA",
    light: { bg: "#F9FAF8", surface: "#EEF3EF", card: "#FFFFFF", fg: "#13221C", muted: "#4B6158", primary: "#156847", primaryFg: "#FFFFFF", badgeBg: "#E3F5EC", badgeFg: "#0F5137" },
    dark: { bg: "#0C1411", surface: "#1A2923", card: "#131E1A", fg: "#EDF5F1", muted: "#94ACA2", primary: "#2EA876", primaryFg: "#061A12", badgeBg: "rgba(46,168,118,0.18)", badgeFg: "#6EE7B7" },
  },
  {
    id: "indigo",
    name: "Royal Indigo",
    tagline: "Stripe-grade clarity across Store & Admin",
    contrast: "8.5:1 AAA",
    light: { bg: "#FFFFFF", surface: "#F3F4F8", card: "#FFFFFF", fg: "#0F172A", muted: "#475569", primary: "#4338CA", primaryFg: "#FFFFFF", badgeBg: "#EEF2FF", badgeFg: "#3730A3" },
    dark: { bg: "#0B0E17", surface: "#1C2336", card: "#131826", fg: "#F1F5F9", muted: "#94A3B8", primary: "#6366F1", primaryFg: "#FFFFFF", badgeBg: "rgba(99,102,241,0.20)", badgeFg: "#A5B4FC" },
  },
  {
    id: "teal",
    name: "Deep Teal & Sand",
    tagline: "Calm coastal studio — home decor & crafts",
    contrast: "5.9:1 AA",
    light: { bg: "#FAF9F6", surface: "#EDF4F5", card: "#FFFFFF", fg: "#0C2D36", muted: "#4A666E", primary: "#0F6B75", primaryFg: "#FFFFFF", badgeBg: "#E2F4F6", badgeFg: "#0B535B" },
    dark: { bg: "#0A1417", surface: "#182B31", card: "#111F24", fg: "#ECF6F8", muted: "#8FAAB2", primary: "#22A6B3", primaryFg: "#05191C", badgeBg: "rgba(34,166,179,0.20)", badgeFg: "#67E8F9" },
  },
  {
    id: "burgundy",
    name: "Burgundy & Cream",
    tagline: "Indian heritage boutique — pairs with logo",
    contrast: "7.9:1 AAA",
    light: { bg: "#FCF9F5", surface: "#F5ECEE", card: "#FFFFFF", fg: "#26181A", muted: "#695457", primary: "#8C2336", primaryFg: "#FFFFFF", badgeBg: "#FBE8EC", badgeFg: "#731A2B" },
    dark: { bg: "#150E10", surface: "#2B1D21", card: "#201518", fg: "#FAF2F3", muted: "#B59CA0", primary: "#D94E67", primaryFg: "#FFFFFF", badgeBg: "rgba(217,78,103,0.20)", badgeFg: "#FDA4AF" },
  },
  {
    id: "cobalt",
    name: "Midnight Cobalt",
    tagline: "Sharp, familiar high-trust e-commerce",
    contrast: "6.7:1 AA",
    light: { bg: "#F8FAFC", surface: "#EEF2F7", card: "#FFFFFF", fg: "#0B1F3A", muted: "#475D78", primary: "#1D4ED8", primaryFg: "#FFFFFF", badgeBg: "#DBEAFE", badgeFg: "#1E40AF" },
    dark: { bg: "#09101D", surface: "#192640", card: "#111B2E", fg: "#EFF6FF", muted: "#93A8C7", primary: "#3B82F6", primaryFg: "#FFFFFF", badgeBg: "rgba(59,130,246,0.20)", badgeFg: "#93C5FD" },
  },
  {
    id: "charcoal",
    name: "Charcoal Gallery",
    tagline: "Minimalist luxury — product photos lead",
    contrast: "17.7:1 AAA",
    light: { bg: "#FFFFFF", surface: "#F4F4F5", card: "#FFFFFF", fg: "#141414", muted: "#52525B", primary: "#18181B", primaryFg: "#FFFFFF", badgeBg: "#FEF3C7", badgeFg: "#92400E" },
    dark: { bg: "#0C0C0E", surface: "#202026", card: "#16161A", fg: "#FAFAFA", muted: "#A1A1AA", primary: "#FAFAFA", primaryFg: "#111113", badgeBg: "rgba(251,191,36,0.18)", badgeFg: "#FDE68A" },
  },
] as const

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim())
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim()
  return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toUpperCase() : fallback
}

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && (THEME_PRESET_IDS as readonly string[]).includes(value)
}

export function parseCustomTheme(raw: unknown): CustomThemeColors | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (!isValidHexColor(r.primary) || !isValidHexColor(r.background) || !isValidHexColor(r.foreground)) {
    return null
  }
  return {
    primary: r.primary.trim().toUpperCase(),
    background: r.background.trim().toUpperCase(),
    foreground: r.foreground.trim().toUpperCase(),
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return `#${[clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

function mixHex(a: string, b: string, weightA: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const w = Math.max(0, Math.min(1, weightA))
  return rgbToHex(r1 * w + r2 * (1 - w), g1 * w + g2 * (1 - w), b1 * w + b2 * (1 - w))
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.1 contrast ratio between two 6-digit hex colors (1.0 to 21.0). */
export function contrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA)
  const l2 = relativeLuminance(hexB)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Picks pure white or deep ink for maximum legibility on a solid button/badge color. */
export function bestTextOn(bgHex: string): "#FFFFFF" | "#111111" {
  return contrastRatio(bgHex, "#FFFFFF") >= contrastRatio(bgHex, "#111111") ? "#FFFFFF" : "#111111"
}

/**
 * Derives a complete Light + Dark palette preview & CSS variable block from 3 brand colors.
 * Strictly validates all inputs as 6-digit hex codes so the generated CSS is completely safe for SSR `<style>`.
 */
export function deriveCustomThemeTokens(input: CustomThemeColors) {
  const primary = normalizeHexColor(input.primary, DEFAULT_CUSTOM_THEME.primary)
  const background = normalizeHexColor(input.background, DEFAULT_CUSTOM_THEME.background)
  const foreground = normalizeHexColor(input.foreground, DEFAULT_CUSTOM_THEME.foreground)

  const primaryFg = bestTextOn(primary)
  const primaryHover = mixHex(primary, "#000000", 0.86)
  const lightSurface = mixHex(background, foreground, 0.94)
  const lightCard = mixHex(background, "#FFFFFF", 0.35)
  const lightMuted = mixHex(background, foreground, 0.92)
  const lightMutedFg = mixHex(foreground, background, 0.68)
  const lightAccent = mixHex(primary, background, 0.12)

  // Auto-derived harmonious Dark mode
  const darkBg = mixHex("#0E1015", foreground, 0.88)
  const darkCard = mixHex("#171A22", foreground, 0.88)
  const darkSurface = mixHex("#1E222D", foreground, 0.88)
  const darkFg = mixHex("#F5F7FA", background, 0.85)
  const darkMutedFg = mixHex("#9CA6B8", background, 0.85)
  const darkPrimary = relativeLuminance(primary) < 0.18 ? mixHex(primary, "#FFFFFF", 0.72) : primary
  const darkPrimaryFg = bestTextOn(darkPrimary)
  const darkPrimaryHover = mixHex(darkPrimary, "#FFFFFF", 0.86)

  return {
    light: {
      bg: background,
      surface: lightSurface,
      card: lightCard,
      muted: lightMuted,
      fg: foreground,
      mutedFg: lightMutedFg,
      primary,
      primaryFg,
      primaryHover,
      accent: lightAccent,
      badgeBg: lightAccent,
      badgeFg: primary,
    },
    dark: {
      bg: darkBg,
      surface: darkSurface,
      card: darkCard,
      muted: darkSurface,
      fg: darkFg,
      mutedFg: darkMutedFg,
      primary: darkPrimary,
      primaryFg: darkPrimaryFg,
      primaryHover: darkPrimaryHover,
      accent: mixHex(darkPrimary, darkBg, 0.2),
      badgeBg: mixHex(darkPrimary, darkBg, 0.22),
      badgeFg: mixHex(darkPrimary, "#FFFFFF", 0.65),
    },
    textContrast: contrastRatio(foreground, background),
    primaryContrast: contrastRatio(primary, primaryFg),
  }
}

export type ThemeBrandPalette = {
  boxColor: string
  ribbon: string
  accent: string
  themeColor: string
  backgroundColor: string
  gradient: string
  borderColor: string
  versionKey: string
}

/**
 * Resolves the active theme's brand icon palette (used by Favicon, Apple Touch Icon,
 * PWA icons, Web Manifest, and viewport themeColor) so icons always stay in sync with the chosen theme.
 */
export function resolveThemeBrandPalette(
  preset: ThemePresetId,
  custom: CustomThemeColors | null
): ThemeBrandPalette {
  const activeLight =
    preset === "custom" && custom
      ? deriveCustomThemeTokens(custom).light
      : (THEME_PRESETS.find((p) => p.id === preset) ?? THEME_PRESETS[0]).light

  const primary = activeLight.primary
  const lightStop = mixHex(primary, "#FFFFFF", 0.82)
  const deepStop = mixHex(primary, "#000000", 0.68)
  const accent = mixHex(primary, "#000000", 0.72)
  const versionKey =
    preset === "custom" && custom
      ? `custom-${primary.slice(1).toLowerCase()}-${activeLight.bg.slice(1).toLowerCase()}`
      : preset

  return {
    boxColor: "#FFFAF4",
    ribbon: "#FBD07C",
    accent,
    themeColor: primary,
    backgroundColor: activeLight.bg,
    gradient: `linear-gradient(140deg, ${lightStop} 0%, ${primary} 48%, ${deepStop} 100%)`,
    borderColor: "rgba(255, 255, 255, 0.28)",
    versionKey,
  }
}

export function buildCustomThemeCss(input: CustomThemeColors): string {
  const { light: l, dark: d } = deriveCustomThemeTokens(input)
  return `:root[data-theme="custom"] {
  --background: ${l.bg};
  --foreground: ${l.fg};
  --card: ${l.card};
  --card-foreground: ${l.fg};
  --popover: ${l.card};
  --popover-foreground: ${l.fg};
  --primary: ${l.primary};
  --primary-foreground: ${l.primaryFg};
  --secondary: ${l.surface};
  --secondary-foreground: ${l.fg};
  --muted: ${l.muted};
  --muted-foreground: ${l.mutedFg};
  --accent: ${l.accent};
  --accent-foreground: ${l.primary};
  --ring: ${l.primary};
  --store-calm-bg: ${l.bg};
  --store-calm-card: ${l.card};
  --store-section-tint: ${l.surface};
  --store-sky-surface: ${l.surface};
  --store-sky-soft: ${l.muted};
  --store-support: ${l.fg};
  --store-support-fg: ${l.bg};
  --store-support-surface: ${l.surface};
  --store-support-muted: ${l.mutedFg};
  --store-accent: ${l.primary};
  --store-accent-hover: ${l.primaryHover};
  --store-accent-fg: ${l.primaryFg};
  --admin-surface: ${l.surface};
  --admin-card: ${l.card};
  --admin-card-hover: ${l.bg};
  --admin-well: ${l.muted};
  --sidebar: ${l.surface};
  --sidebar-foreground: ${l.fg};
  --sidebar-primary: ${l.primary};
  --sidebar-primary-foreground: ${l.primaryFg};
  --sidebar-accent: ${l.accent};
  --sidebar-accent-foreground: ${l.fg};
  --sidebar-ring: ${l.primary};
  --hero-a: color-mix(in oklab, ${l.primary} 12%, transparent);
  --hero-b: color-mix(in oklab, ${l.fg} 7%, transparent);
  --hero-c: color-mix(in oklab, ${l.primary} 8%, transparent);
  --text-gradient-mid: ${l.primary};
}
.dark[data-theme="custom"] {
  --background: ${d.bg};
  --foreground: ${d.fg};
  --card: ${d.card};
  --card-foreground: ${d.fg};
  --popover: ${d.card};
  --popover-foreground: ${d.fg};
  --primary: ${d.primary};
  --primary-foreground: ${d.primaryFg};
  --secondary: ${d.surface};
  --secondary-foreground: ${d.fg};
  --muted: ${d.muted};
  --muted-foreground: ${d.mutedFg};
  --accent: ${d.accent};
  --accent-foreground: ${d.badgeFg};
  --ring: ${d.primary};
  --store-calm-bg: ${d.bg};
  --store-calm-card: ${d.card};
  --store-section-tint: ${d.surface};
  --store-sky-surface: ${d.surface};
  --store-sky-soft: ${d.muted};
  --store-support: ${d.surface};
  --store-support-fg: ${d.fg};
  --store-support-surface: ${d.surface};
  --store-support-muted: ${d.mutedFg};
  --store-accent: ${d.primary};
  --store-accent-hover: ${d.primaryHover};
  --store-accent-fg: ${d.primaryFg};
  --admin-surface: ${d.bg};
  --admin-card: ${d.card};
  --admin-card-hover: ${d.surface};
  --admin-well: ${d.muted};
  --sidebar: ${d.card};
  --sidebar-foreground: ${d.fg};
  --sidebar-primary: ${d.primary};
  --sidebar-primary-foreground: ${d.primaryFg};
  --sidebar-accent: ${d.surface};
  --sidebar-accent-foreground: ${d.fg};
  --sidebar-ring: ${d.primary};
  --hero-a: color-mix(in oklab, ${d.primary} 16%, transparent);
  --hero-b: color-mix(in oklab, ${d.fg} 8%, transparent);
  --hero-c: color-mix(in oklab, ${d.primary} 10%, transparent);
  --text-gradient-mid: ${d.primary};
}`
}

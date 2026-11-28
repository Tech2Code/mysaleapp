"use client"

import { AlertTriangleIcon, CheckIcon, MoonIcon, RotateCcwIcon, SlidersHorizontalIcon, SunIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DEFAULT_CUSTOM_THEME,
  THEME_PRESETS,
  deriveCustomThemeTokens,
  isValidHexColor,
  type CustomThemeColors,
  type ThemePresetId,
} from "@/features/settings/theme"
import { cn } from "@/lib/utils"
import styles from "./theme-settings-section.module.css"

type Props = {
  value: ThemePresetId
  customColors: CustomThemeColors
  shopName: string
  customErrors?: {
    primary?: string
    background?: string
    foreground?: string
  }
  onChangePreset: (preset: ThemePresetId) => void
  onChangeCustom: (next: CustomThemeColors) => void
}

export function ThemeSettingsSection({
  value,
  customColors,
  shopName,
  customErrors,
  onChangePreset,
  onChangeCustom,
}: Props) {
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light")

  const derivedCustom = deriveCustomThemeTokens(customColors)
  const activePresetMeta = THEME_PRESETS.find((p) => p.id === value)

  const previewPalette =
    value === "custom"
      ? {
          bg: derivedCustom[previewMode].bg,
          surface: derivedCustom[previewMode].surface,
          card: derivedCustom[previewMode].card,
          fg: derivedCustom[previewMode].fg,
          muted: derivedCustom[previewMode].mutedFg,
          primary: derivedCustom[previewMode].primary,
          primaryFg: derivedCustom[previewMode].primaryFg,
          badgeBg: derivedCustom[previewMode].badgeBg,
          badgeFg: derivedCustom[previewMode].badgeFg,
        }
      : (activePresetMeta ?? THEME_PRESETS[0])[previewMode]

  const previewBorder = previewMode === "light" ? "rgba(15, 23, 42, 0.11)" : "rgba(255, 255, 255, 0.12)"
  const brandInitial = (shopName.trim()[0] ?? "K").toUpperCase()
  const activeLabel = value === "custom" ? "Custom Theme" : (activePresetMeta?.name ?? "Artisanal Terracotta")

  const updateCustomField = (field: keyof CustomThemeColors, raw: string) => {
    const cleaned = raw.startsWith("#") ? raw.slice(0, 7) : `#${raw.slice(0, 6)}`
    onChangeCustom({ ...customColors, [field]: cleaned.toUpperCase() })
  }

  return (
    <div className={styles.themeWorkspace}>
      {/* Live Dual Preview: Storefront + Admin */}
      <div className={styles.previewBox}>
        <div className={styles.previewHeaderRow}>
          <div className={styles.previewHeadingGroup}>
            <p className={styles.previewTitle}>Live preview</p>
            <span className={styles.previewTag}>{activeLabel}</span>
          </div>
          <div className={styles.previewModeGroup} role="group" aria-label="Preview color mode">
            <button
              type="button"
              className={cn(styles.previewModeBtn, previewMode === "light" && styles.previewModeBtnActive)}
              aria-pressed={previewMode === "light"}
              onClick={() => setPreviewMode("light")}
            >
              <SunIcon className={styles.icon12} aria-hidden />
              Light
            </button>
            <button
              type="button"
              className={cn(styles.previewModeBtn, previewMode === "dark" && styles.previewModeBtnActive)}
              aria-pressed={previewMode === "dark"}
              onClick={() => setPreviewMode("dark")}
            >
              <MoonIcon className={styles.icon12} aria-hidden />
              Dark
            </button>
          </div>
        </div>

        <div className={styles.previewSplitGrid}>
          {/* Storefront Mini Preview */}
          <div
            className={styles.miniSurfaceCard}
            style={{ backgroundColor: previewPalette.bg, color: previewPalette.fg, borderColor: previewBorder }}
          >
            <div className={styles.miniTopBar} style={{ borderColor: previewBorder }}>
              <span className={styles.miniBrandGroup}>
                <span
                  className={styles.miniLogoBadge}
                  style={{ backgroundColor: previewPalette.primary, color: previewPalette.primaryFg }}
                >
                  {brandInitial}
                </span>
                <span>{shopName || "Kalakriti"}</span>
              </span>
              <span
                className={styles.miniPillBadge}
                style={{ backgroundColor: previewPalette.badgeBg, color: previewPalette.badgeFg }}
              >
                Cart 2
              </span>
            </div>
            <div className={styles.miniStoreRow}>
              <div className={styles.miniProductThumb} style={{ backgroundColor: previewPalette.surface }}>
                <span
                  className={styles.miniOffTag}
                  style={{ backgroundColor: previewPalette.primary, color: previewPalette.primaryFg }}
                >
                  20% OFF
                </span>
              </div>
              <div className={styles.miniProductInfo}>
                <div>
                  <div className={styles.miniCatLabel} style={{ color: previewPalette.muted }}>
                    Home Decor
                  </div>
                  <div className={styles.miniProductTitle}>Handcrafted Brass Diya</div>
                  <div className={styles.miniPriceRow}>
                    <span className={styles.miniPriceNow}>₹1,499</span>
                    <span className={styles.miniPriceOld} style={{ color: previewPalette.muted }}>
                      ₹1,899
                    </span>
                  </div>
                </div>
                <div className={styles.miniBtnRow}>
                  <span
                    className={styles.miniPrimaryBtn}
                    style={{ backgroundColor: previewPalette.primary, color: previewPalette.primaryFg }}
                  >
                    Add to Cart
                  </span>
                  <span
                    className={styles.miniOutlineBtn}
                    style={{
                      backgroundColor: previewPalette.card,
                      color: previewPalette.fg,
                      borderColor: previewBorder,
                    }}
                  >
                    Save
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Mini Preview */}
          <div
            className={styles.miniSurfaceCard}
            style={{ backgroundColor: previewPalette.surface, color: previewPalette.fg, borderColor: previewBorder }}
          >
            <div className={styles.miniTopBar} style={{ borderColor: previewBorder }}>
              <span className={styles.miniBrandGroup}>
                <span className={styles.miniStatusDot} style={{ backgroundColor: previewPalette.primary }} />
                <span>Admin Panel</span>
              </span>
              <span
                className={styles.miniPillBadge}
                style={{ backgroundColor: previewPalette.badgeBg, color: previewPalette.badgeFg }}
              >
                3 Pending
              </span>
            </div>
            <div className={styles.miniKpiGrid}>
              <div
                className={styles.miniKpiTile}
                style={{ backgroundColor: previewPalette.card, borderColor: previewBorder }}
              >
                <div className={styles.miniKpiLabel} style={{ color: previewPalette.muted }}>
                  Revenue (30d)
                </div>
                <div className={styles.miniKpiValue}>₹1,24,800</div>
              </div>
              <div
                className={styles.miniKpiTile}
                style={{ backgroundColor: previewPalette.card, borderColor: previewBorder }}
              >
                <div className={styles.miniKpiLabel} style={{ color: previewPalette.muted }}>
                  Orders
                </div>
                <div className={styles.miniKpiValue}>86</div>
              </div>
            </div>
            <div className={styles.miniOrderRow}>
              <div className={styles.miniOrderCard} style={{ backgroundColor: previewPalette.card }}>
                <span className={styles.miniOrderMono}>#KK-1048</span>
                <span
                  className={styles.miniPillBadge}
                  style={{ backgroundColor: previewPalette.badgeBg, color: previewPalette.badgeFg }}
                >
                  Paid
                </span>
              </div>
              <span
                className={styles.miniDispatchBtn}
                style={{ backgroundColor: previewPalette.primary, color: previewPalette.primaryFg }}
              >
                Dispatch
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 8 Curated Presets + Custom Card */}
      <div className={styles.presetGrid} role="radiogroup" aria-label="Unified store and admin theme">
        {THEME_PRESETS.map((preset) => {
          const isSelected = value === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={cn(styles.presetCardBtn, isSelected && styles.presetCardActive)}
              onClick={() => onChangePreset(preset.id)}
            >
              <div className={styles.presetTopRow}>
                <span className={styles.swatchDotsRow} aria-hidden>
                  <span className={styles.swatchDot} style={{ backgroundColor: preset.light.bg }} />
                  <span className={styles.swatchDot} style={{ backgroundColor: preset.light.surface }} />
                  <span className={styles.swatchDot} style={{ backgroundColor: preset.light.fg }} />
                  <span className={styles.swatchDot} style={{ backgroundColor: preset.light.primary }} />
                </span>
                {isSelected ? (
                  <span className={styles.activeCheckCircle} aria-hidden>
                    <CheckIcon className={styles.icon12} />
                  </span>
                ) : (
                  <span className={styles.contrastMicroPill}>{preset.contrast}</span>
                )}
              </div>
              <div className={styles.presetTextCol}>
                <span className={styles.presetNameRow}>
                  <span>{preset.name}</span>
                  {preset.recommended && <span className={styles.recommendedPill}>Default</span>}
                </span>
                <p className={styles.presetTagline}>{preset.tagline}</p>
              </div>
            </button>
          )
        })}

        <button
          type="button"
          role="radio"
          aria-checked={value === "custom"}
          className={cn(styles.presetCardBtn, value === "custom" && styles.presetCardActive)}
          onClick={() => onChangePreset("custom")}
        >
          <div className={styles.presetTopRow}>
            <span className={styles.swatchDotsRow} aria-hidden>
              <span
                className={styles.swatchDot}
                style={{ backgroundColor: isValidHexColor(customColors.background) ? customColors.background : DEFAULT_CUSTOM_THEME.background }}
              />
              <span
                className={styles.swatchDot}
                style={{ backgroundColor: isValidHexColor(customColors.foreground) ? customColors.foreground : DEFAULT_CUSTOM_THEME.foreground }}
              />
              <span
                className={styles.swatchDot}
                style={{ backgroundColor: isValidHexColor(customColors.primary) ? customColors.primary : DEFAULT_CUSTOM_THEME.primary }}
              />
            </span>
            {value === "custom" ? (
              <span className={styles.activeCheckCircle} aria-hidden>
                <CheckIcon className={styles.icon12} />
              </span>
            ) : (
              <SlidersHorizontalIcon className={styles.icon14} aria-hidden />
            )}
          </div>
          <div className={styles.presetTextCol}>
            <span className={styles.presetNameRow}>
              <span>Custom Theme</span>
            </span>
            <p className={styles.presetTagline}>Pick your own 3 brand colors (auto Dark mode)</p>
          </div>
        </button>
      </div>

      {/* Custom 3-Color Builder Panel */}
      {value === "custom" && (
        <div className={styles.customBuilderPanel}>
          <div className={styles.customBuilderTop}>
            <div>
              <h3 className={styles.customBuilderHeading}>Custom 3-color builder</h3>
              <p className={styles.customBuilderSub}>
                Hover states, borders, cards, and Dark mode are generated automatically from these 3 colors.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChangeCustom(DEFAULT_CUSTOM_THEME)}
            >
              <RotateCcwIcon className={styles.icon14} aria-hidden />
              Reset colors
            </Button>
          </div>

          <div className={styles.colorPickersGrid}>
            <div className={styles.colorPickerField}>
              <label htmlFor="theme-custom-primary" className={styles.colorFieldLabel}>
                Primary Brand (Buttons & Links)
              </label>
              <div className={styles.colorInputWrap}>
                <input
                  type="color"
                  aria-label="Pick Primary Brand color"
                  className={styles.nativeColorSwatch}
                  value={isValidHexColor(customColors.primary) ? customColors.primary : DEFAULT_CUSTOM_THEME.primary}
                  onChange={(e) => updateCustomField("primary", e.target.value)}
                />
                <input
                  id="theme-custom-primary"
                  type="text"
                  maxLength={7}
                  className={styles.hexTextInput}
                  value={customColors.primary}
                  onChange={(e) => updateCustomField("primary", e.target.value)}
                  placeholder="#B84A27"
                />
              </div>
              {customErrors?.primary && <p className={styles.colorFieldError}>{customErrors.primary}</p>}
            </div>

            <div className={styles.colorPickerField}>
              <label htmlFor="theme-custom-bg" className={styles.colorFieldLabel}>
                Page Background
              </label>
              <div className={styles.colorInputWrap}>
                <input
                  type="color"
                  aria-label="Pick Page Background color"
                  className={styles.nativeColorSwatch}
                  value={isValidHexColor(customColors.background) ? customColors.background : DEFAULT_CUSTOM_THEME.background}
                  onChange={(e) => updateCustomField("background", e.target.value)}
                />
                <input
                  id="theme-custom-bg"
                  type="text"
                  maxLength={7}
                  className={styles.hexTextInput}
                  value={customColors.background}
                  onChange={(e) => updateCustomField("background", e.target.value)}
                  placeholder="#FAF8F5"
                />
              </div>
              {customErrors?.background && <p className={styles.colorFieldError}>{customErrors.background}</p>}
            </div>

            <div className={styles.colorPickerField}>
              <label htmlFor="theme-custom-fg" className={styles.colorFieldLabel}>
                Text Ink
              </label>
              <div className={styles.colorInputWrap}>
                <input
                  type="color"
                  aria-label="Pick Text Ink color"
                  className={styles.nativeColorSwatch}
                  value={isValidHexColor(customColors.foreground) ? customColors.foreground : DEFAULT_CUSTOM_THEME.foreground}
                  onChange={(e) => updateCustomField("foreground", e.target.value)}
                />
                <input
                  id="theme-custom-fg"
                  type="text"
                  maxLength={7}
                  className={styles.hexTextInput}
                  value={customColors.foreground}
                  onChange={(e) => updateCustomField("foreground", e.target.value)}
                  placeholder="#231B17"
                />
              </div>
              {customErrors?.foreground && <p className={styles.colorFieldError}>{customErrors.foreground}</p>}
            </div>
          </div>

          <div className={styles.contrastBar}>
            <span
              className={derivedCustom.textContrast >= 4.5 ? styles.contrastBadgeOk : styles.contrastBadgeWarn}
            >
              {derivedCustom.textContrast >= 4.5 ? (
                <CheckIcon className={styles.icon12} aria-hidden />
              ) : (
                <AlertTriangleIcon className={styles.icon12} aria-hidden />
              )}
              Text contrast: {derivedCustom.textContrast.toFixed(1)}:1{" "}
              {derivedCustom.textContrast >= 4.5 ? "(WCAG AA)" : "(Aim for 4.5:1+)"}
            </span>
            <span
              className={derivedCustom.primaryContrast >= 4.5 ? styles.contrastBadgeOk : styles.contrastBadgeWarn}
            >
              {derivedCustom.primaryContrast >= 4.5 ? (
                <CheckIcon className={styles.icon12} aria-hidden />
              ) : (
                <AlertTriangleIcon className={styles.icon12} aria-hidden />
              )}
              Button contrast: {derivedCustom.primaryContrast.toFixed(1)}:1{" "}
              {derivedCustom.primaryContrast >= 4.5 ? "(WCAG AA)" : "(Aim for 4.5:1+)"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

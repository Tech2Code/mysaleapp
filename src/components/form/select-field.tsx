"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, RotateCcwIcon } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { describedBy, FieldShell, FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"
import styles from "./form.module.css"

export type SelectOption = {
  value: string
  label: string
  /** Visual role of the option (e.g. current status, recommended next step, step revert/undo, or attention count). */
  tone?: "default" | "current" | "next" | "revert" | "attention"
  /** Optional custom pill badge text shown on the right of the option. */
  badge?: string
}

export type SelectFieldProps = {
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
  options: readonly SelectOption[]
  /** Controlled value. "" means nothing chosen. */
  value: string
  onValueChange: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  disabled?: boolean
  /** Adds a first, empty choice with this text; it is also what shows when nothing is chosen. */
  placeholder?: string
  /** Short category prefix shown inside the closed trigger (e.g. "Status:", "Payment:"). */
  prefix?: string
  /** Highlights the trigger border/background when a non-default filter value is active. */
  activeFilter?: boolean
  fieldSize?: FieldSize
  pill?: boolean
  className?: string
  containerClassName?: string
  /** No reserved strip for an error under the field (filters, search boxes). Pill fields never reserve one. */
  noErrorSpace?: boolean
}

/** Base UI can't use "" as a value, so the empty choice uses this stand-in internally. */
const NONE = "__none__"

/**
 * Dropdown in the app's own style (not the browser's grey list): rounded popup, check mark on the chosen
 * item, keyboard + screen-reader support, and it opens as a floating panel so it is never clipped by a
 * dialog or a scrolling card. Controlled; in react-hook-form forms use <FormSelectField>.
 */
export function SelectField({
  label,
  hideLabel,
  error,
  hint,
  options,
  value,
  onValueChange,
  onBlur,
  name,
  id: idProp,
  disabled,
  placeholder,
  prefix,
  activeFilter,
  fieldSize = "lg",
  pill,
  className,
  containerClassName,
  noErrorSpace,
}: SelectFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId

  const items: SelectOption[] = placeholder !== undefined ? [{ value: NONE, label: placeholder }, ...options] : [...options]
  const current = value === "" ? null : value
  const selectedOption = options.find((o) => o.value === value)
  const selectedLabel = selectedOption?.label
  const isRevertSelected = selectedOption?.tone === "revert"
  const isNextSelected = selectedOption?.tone === "next"

  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} error={error} hint={hint} className={containerClassName} noErrorSpace={noErrorSpace || pill}>
      <SelectPrimitive.Root
        modal={false}
        name={name}
        disabled={disabled}
        value={current}
        onValueChange={(next) => onValueChange(next === null || next === NONE ? "" : String(next))}
        onOpenChange={(open) => {
          if (!open) onBlur?.()
        }}
      >
        <SelectPrimitive.Trigger
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(
            styles.selectTrigger,
            isRevertSelected && styles.selectTriggerRevert,
            isNextSelected && styles.selectTriggerNext,
            activeFilter && !isRevertSelected && !isNextSelected && styles.selectTriggerActiveFilter,
            pill ? cn(PILL, styles.selectTriggerPill) : FIELD_HEIGHT[fieldSize],
            className
          )}
        >
          <span

            title={selectedLabel ? (prefix ? `${prefix} ${selectedLabel}` : selectedLabel) : placeholder ?? undefined}
            className={cn(styles.triggerContent, !selectedLabel && styles.triggerContentPlaceholder)}
          >
            {isRevertSelected && <RotateCcwIcon className={styles.revertIcon} aria-hidden />}
            {isNextSelected && <ArrowRightIcon className={styles.nextIcon} aria-hidden />}
            {prefix && (
              <span className={styles.prefixLabel}>
                {prefix}
              </span>
            )}
            <span className={cn(styles.valueTrunc, prefix && styles.valueTruncMedium)}>
              {selectedLabel ?? placeholder ?? "Select…"}
            </span>
            {isRevertSelected && (
              <span className={styles.revertBadge}>
                {selectedOption?.badge ?? "Revert"}
              </span>
            )}
            {isNextSelected && (
              <span className={styles.nextBadge}>
                {selectedOption?.badge ?? "Next step"}
              </span>
            )}
            {selectedOption?.badge && !isRevertSelected && !isNextSelected && (
              <span

                className={cn(
                  styles.countBadge,
                  selectedOption.tone === "attention" ? styles.countBadgeAttention : styles.countBadgeDefault
                )}
              >
                {selectedOption.tone === "attention" && <span className={styles.attentionDot} aria-hidden />}
                {selectedOption.badge}
              </span>
            )}
          </span>
          <SelectPrimitive.Icon className={styles.chevronTriggerIcon}>
            <ChevronDownIcon className={styles.icon16} aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false} className={styles.selectPositioner}>
            <SelectPrimitive.Popup
              data-slot="select-content"
              className={styles.selectPopup}
            >
              <SelectPrimitive.List className={styles.selectList}>
                {items.map((item) => {
                  const isRevert = item.tone === "revert"
                  const isNext = item.tone === "next"
                  const isCurrent = item.tone === "current"

                  return (
                    <SelectPrimitive.Item
                      key={item.value}
                      value={item.value}
                      title={item.label}
                      className={cn(
                        styles.selectItem,
                        isRevert
                          ? styles.selectItemRevert
                          : isNext
                            ? styles.selectItemNext
                            : styles.selectItemDefault,
                        item.value === NONE && styles.selectItemNone
                      )}
                    >
                      {isRevert && <RotateCcwIcon className={styles.revertIcon} aria-hidden />}
                      {isNext && <ArrowRightIcon className={styles.nextIcon} aria-hidden />}
                      <SelectPrimitive.ItemText className={styles.itemTextTrunc}>{item.label}</SelectPrimitive.ItemText>
                      {isCurrent && (
                        <span className={styles.currentPillBadge}>
                          {item.badge ?? "Current"}
                        </span>
                      )}
                      {isNext && (
                        <span className={styles.nextPillBadge}>
                          {item.badge ?? "Next step"}
                        </span>
                      )}
                      {isRevert && (
                        <span className={styles.revertPillBadge}>
                          {item.badge ?? "Undo"}
                        </span>
                      )}
                      {item.badge && !isCurrent && !isNext && !isRevert && (
                        <span

                          className={cn(
                            styles.itemCountBadge,
                            item.tone === "attention" ? styles.countBadgeAttention : styles.countBadgeDefault
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                      <SelectPrimitive.ItemIndicator
                        className={cn(
                          styles.itemIndicator,
                          isRevert ? styles.indicatorRevert : isNext ? styles.indicatorNext : styles.indicatorPrimary
                        )}
                      >
                        <CheckIcon className={styles.icon16} aria-hidden />
                      </SelectPrimitive.ItemIndicator>
                    </SelectPrimitive.Item>
                  )
                })}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </FieldShell>
  )
}

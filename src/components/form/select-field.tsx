"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { ArrowRightIcon, CheckIcon, ChevronDownIcon, RotateCcwIcon } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { describedBy, FieldShell, FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"

export type SelectOption = {
  value: string
  label: string
  /** Visual role of the option (e.g. current status, recommended next step, or step revert/undo). */
  tone?: "default" | "current" | "next" | "revert"
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
            "group flex w-full min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden rounded-lg border border-input bg-background px-3 text-left text-sm outline-none transition-all",
            "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
            "data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isRevertSelected && "border-amber-400/90 bg-amber-50/70 text-amber-950 hover:border-amber-500 dark:border-amber-700/80 dark:bg-amber-950/30 dark:text-amber-100",
            isNextSelected && "border-emerald-400/90 bg-emerald-50/60 text-emerald-950 hover:border-emerald-500 dark:border-emerald-700/80 dark:bg-emerald-950/25 dark:text-emerald-100",
            pill ? `${PILL} bg-card font-medium shadow-sm` : FIELD_HEIGHT[fieldSize],
            className
          )}
        >
          <span
            data-ui="form/SelectField/span"
            title={selectedLabel ?? placeholder ?? undefined}
            className={cn("flex min-w-0 flex-1 items-center gap-2 text-left", !selectedLabel && "text-muted-foreground/60")}
          >
            {isRevertSelected && <RotateCcwIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
            {isNextSelected && <ArrowRightIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
            <span data-ui="form/SelectField/span-2" className="truncate">{selectedLabel ?? placeholder ?? "Select…"}</span>
            {isRevertSelected && (
              <span data-ui="form/SelectField/span-3" className="ml-auto shrink-0 rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                {selectedOption?.badge ?? "Revert"}
              </span>
            )}
            {isNextSelected && (
              <span data-ui="form/SelectField/span-4" className="ml-auto shrink-0 rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                {selectedOption?.badge ?? "Next step"}
              </span>
            )}
          </span>
          <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180">
            <ChevronDownIcon className="size-4" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false} className="z-70 max-w-[calc(100dvw-2rem)] outline-none">
            <SelectPrimitive.Popup
              data-slot="select-content"
              className={cn(
                "max-h-(--available-height) min-w-(--anchor-width) max-w-[calc(100dvw-2rem)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl outline-none",
                "transition-[opacity,transform] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
              )}
            >
              <SelectPrimitive.List className="space-y-1 outline-none">
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
                        "relative flex min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none",
                        isRevert
                          ? "border border-amber-300/60 bg-amber-50/60 text-amber-950 data-highlighted:bg-amber-100/90 data-highlighted:text-amber-950 data-selected:font-semibold data-selected:text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-200 dark:data-highlighted:bg-amber-900/45 dark:data-selected:text-amber-100"
                          : isNext
                            ? "border border-emerald-300/60 bg-emerald-50/60 font-medium text-emerald-950 data-highlighted:bg-emerald-100/90 data-highlighted:text-emerald-950 data-selected:font-semibold data-selected:text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-200 dark:data-highlighted:bg-emerald-900/45 dark:data-selected:text-emerald-100"
                            : [
                                "data-highlighted:bg-primary/10 data-highlighted:text-foreground",
                                "data-selected:font-semibold data-selected:text-primary",
                              ],
                        item.value === NONE && "text-muted-foreground"
                      )}
                    >
                      {isRevert && <RotateCcwIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />}
                      {isNext && <ArrowRightIcon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
                      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">{item.label}</SelectPrimitive.ItemText>
                      {isCurrent && (
                        <span data-ui="form/SelectField/span-5" className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                          {item.badge ?? "Current"}
                        </span>
                      )}
                      {isNext && (
                        <span data-ui="form/SelectField/span-6" className="shrink-0 rounded-full bg-emerald-200/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                          {item.badge ?? "Next step"}
                        </span>
                      )}
                      {isRevert && (
                        <span data-ui="form/SelectField/span-7" className="shrink-0 rounded-full bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                          {item.badge ?? "Undo"}
                        </span>
                      )}
                      <SelectPrimitive.ItemIndicator
                        className={cn(
                          "absolute right-3 grid place-items-center",
                          isRevert ? "text-amber-700 dark:text-amber-300" : isNext ? "text-emerald-700 dark:text-emerald-300" : "text-primary"
                        )}
                      >
                        <CheckIcon className="size-4" aria-hidden />
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

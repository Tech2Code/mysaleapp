"use client"

import { Select as SelectPrimitive } from "@base-ui/react/select"
import { CheckIcon, ChevronDownIcon } from "lucide-react"
import { useId } from "react"
import { cn } from "@/lib/utils"
import { describedBy, FieldShell, FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"

export type SelectOption = { value: string; label: string }

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
  const selectedLabel = options.find((o) => o.value === value)?.label

  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} error={error} hint={hint} className={containerClassName} noErrorSpace={noErrorSpace || pill}>
      <SelectPrimitive.Root
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
            "group flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-left text-sm outline-none transition-all",
            "hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
            "data-popup-open:border-ring data-popup-open:ring-3 data-popup-open:ring-ring/30",
            "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            pill ? `${PILL} bg-card font-medium shadow-sm` : FIELD_HEIGHT[fieldSize],
            className
          )}
        >
          <span data-ui="form/SelectField/span" className={cn("truncate", !selectedLabel && "text-muted-foreground/60")}>{selectedLabel ?? placeholder ?? "Select…"}</span>
          <SelectPrimitive.Icon className="shrink-0 text-muted-foreground transition-transform duration-200 group-data-popup-open:rotate-180">
            <ChevronDownIcon className="size-4" aria-hidden />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner side="bottom" align="start" sideOffset={6} alignItemWithTrigger={false} className="z-70 outline-none">
            <SelectPrimitive.Popup
              data-slot="select-content"
              className={cn(
                "max-h-(--available-height) min-w-(--anchor-width) origin-(--transform-origin) overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl outline-none",
                "transition-[opacity,transform] duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
              )}
            >
              <SelectPrimitive.List className="space-y-0.5 outline-none">
                {items.map((item) => (
                  <SelectPrimitive.Item
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-2 rounded-lg py-2 pr-9 pl-3 text-sm outline-none select-none",
                      "data-highlighted:bg-primary/10 data-highlighted:text-foreground",
                      "data-selected:font-semibold data-selected:text-primary",
                      item.value === NONE && "text-muted-foreground"
                    )}
                  >
                    <SelectPrimitive.ItemText className="truncate">{item.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator className="absolute right-3 grid place-items-center text-primary">
                      <CheckIcon className="size-4" aria-hidden />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </FieldShell>
  )
}

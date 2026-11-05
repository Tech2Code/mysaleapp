"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { useId, type ComponentProps } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"

export type SearchFieldProps = Omit<ComponentProps<"input">, "type"> & {
  /** Accessible name. Always visually hidden: a search box doesn't need a visible label. */
  label: string
  /** Shows a clear (×) button while there's text. */
  onClear?: () => void
  fieldSize?: FieldSize
  pill?: boolean
  containerClassName?: string
}

/** Search box with icon and clear button. Pass `value` + `onChange` (controlled). */
export function SearchField({
  label,
  onClear,
  fieldSize = "lg",
  pill,
  className,
  containerClassName,
  id: idProp,
  value,
  ...props
}: SearchFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hasText = String(value ?? "").length > 0

  return (
    <div data-ui="form/SearchField" className={cn("relative", containerClassName)}>
      <label data-ui="form/SearchField/label" htmlFor={id} className="sr-only">
        {label}
      </label>
      <SearchIcon
        aria-hidden
        className={cn("pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground", pill ? "left-5" : "left-3")}
      />
      <Input
        id={id}
        type="search"
        value={value}
        className={cn(
          pill ? `${PILL} bg-card pr-10 pl-11 shadow-sm` : cn(FIELD_HEIGHT[fieldSize], "pl-9"),
          // the browser's own clear icon would double up with ours
          "[&::-webkit-search-cancel-button]:hidden",
          className
        )}
        {...props}
      />
      {onClear && hasText && (
        <button data-ui="form/SearchField/button-clear-search"
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className={cn("absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted", pill ? "right-3" : "right-2")}
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}

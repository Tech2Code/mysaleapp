"use client"

import { PlusIcon } from "lucide-react"
import { useId, type ChangeEvent, type ComponentProps, type ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { FIELD_KINDS, type FieldKind } from "@/lib/validation/fields"
import { cn } from "@/lib/utils"
import { describedBy, FieldShell, FIELD_HEIGHT, PILL, type FieldSize } from "./field-shell"

export type TextFieldProps = ComponentProps<"input"> & {
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
  /** Short text or icon shown inside the left edge, e.g. "₹" or "+91". */
  leading?: ReactNode
  /** Autocomplete suggestions (the user can still type anything else). */
  suggestions?: readonly string[]
  fieldSize?: FieldSize
  pill?: boolean
  /**
   * What kind of data this field holds. Blocks characters that can never be valid, caps the length
   * and picks the right mobile keyboard. See src/lib/validation/fields.ts for the list.
   */
  kind?: FieldKind
  /** Class for the outer wrapper (e.g. "sm:col-span-2"). `className` goes to the <input>. */
  containerClassName?: string
  /** No reserved strip for an error under the field (filters, search boxes). Pill fields never reserve one. */
  noErrorSpace?: boolean
}

/** The left affix, centred in a fixed-width box so "+", "₹" and "+91" all line up with the input text. */
function Leading({ children }: { children: ReactNode }) {
  const wide = typeof children === "string" && children.length > 1
  return (
    <span data-ui="form/Leading"
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 grid place-items-center text-sm leading-none font-medium text-muted-foreground",
        wide ? "w-12" : "w-9"
      )}
    >
      {children === "+" ? <PlusIcon className="size-3.5" strokeWidth={2.5} /> : children}
    </span>
  )
}

/**
 * Single-line text input with label, hint and error built in.
 * Works with react-hook-form: `<TextField label="Name" kind="personName" error={errors.name?.message} {...register("name")} />`
 */
export function TextField({
  label,
  hideLabel,
  error,
  hint,
  leading,
  suggestions,
  fieldSize = "lg",
  pill,
  kind,
  className,
  containerClassName,
  noErrorSpace,
  id: idProp,
  onChange,
  ...props
}: TextFieldProps) {
  const autoId = useId()
  const id = idProp ?? autoId
  const listId = suggestions?.length ? `${id}-list` : undefined
  const wideLeading = typeof leading === "string" && leading.length > 1
  const spec = kind ? FIELD_KINDS[kind] : undefined

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (spec?.sanitize) {
      const el = e.currentTarget
      const clean = spec.sanitize(el.value)
      if (clean !== el.value) el.value = clean
    }
    onChange?.(e)
  }

  return (
    <FieldShell id={id} label={label} hideLabel={hideLabel} error={error} hint={hint} className={containerClassName} noErrorSpace={noErrorSpace || pill}>
      <div className="relative">
        {leading && <Leading>{leading}</Leading>}
        <Input
          id={id}
          list={listId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          type={props.type ?? spec?.type}
          inputMode={props.inputMode ?? spec?.inputMode}
          maxLength={props.maxLength ?? spec?.maxLength}
          autoComplete={props.autoComplete ?? spec?.autoComplete}
          autoCapitalize={props.autoCapitalize ?? spec?.autoCapitalize}
          spellCheck={props.spellCheck ?? spec?.spellCheck}
          className={cn(pill ? PILL : FIELD_HEIGHT[fieldSize], leading && (wideLeading ? "pl-12" : "pl-9"), className)}
          {...props}
          onChange={handleChange}
        />
        {listId && (
          <datalist id={listId}>
            {suggestions!.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
      </div>
    </FieldShell>
  )
}

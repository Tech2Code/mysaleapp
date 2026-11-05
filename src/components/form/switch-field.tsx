"use client"

import { useId } from "react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/** On/off toggle with a title and optional description, labelled for screen readers. */
export function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const labelId = `${id}-label`
  const descId = `${id}-desc`

  return (
    <div data-ui="form/SwitchField" className={cn("flex items-center justify-between gap-4 text-sm", className)}>
      <div data-ui="form/SwitchField/div">
        <p data-ui="form/SwitchField/p" id={labelId} className="font-medium">
          {label}
        </p>
        {description && (
          <p data-ui="form/SwitchField/p-2" id={descId} className="text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
      />
    </div>
  )
}

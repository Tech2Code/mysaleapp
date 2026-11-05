"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "sm",
  label,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  size?: "sm" | "lg"
  label: string
}) {
  const btn = cn(
    "grid place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent",
    size === "sm" ? "size-8" : "size-11"
  )
  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn("inline-flex items-center rounded-full border bg-background", size === "lg" && "p-0.5")}
    >
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        <MinusIcon className="size-3.5" />
      </button>
      <span className={cn("min-w-8 text-center font-semibold tabular-nums", size === "lg" && "min-w-10 text-lg")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase quantity">
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}

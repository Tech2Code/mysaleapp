"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function QuantityStepper({
  value,
  max,
  onChange,
  size = "sm",
  label,
  className,
}: {
  className?: string
  value: number
  max: number
  onChange: (value: number) => void
  size?: "sm" | "lg"
  label: string
}) {
  const atMax = value >= max
  const btn = cn(
    "grid place-items-center rounded-full transition-colors hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent",
    size === "sm" ? "size-8" : "size-11"
  )

  const unit = max === 1 ? "item" : "items"

  const handleIncrease = () => {
    if (value >= max) {
      toast.info(`Only ${max} ${unit} available in stock.`, { id: `max-qty-${label}` })
      return
    }
    const next = value + 1
    onChange(next)
    if (next >= max) {
      toast.info(`Only ${max} ${unit} available in stock.`, { id: `max-qty-${label}` })
    }
  }

  return (
    <div data-ui="store/QuantityStepper"
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn("inline-flex items-center rounded-full border bg-background", size === "lg" && "p-0.5", className)}
    >
      <button data-ui="store/QuantityStepper/button-decrease-quantity" type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease quantity">
        <MinusIcon className="size-3.5" />
      </button>
      <span data-ui="store/QuantityStepper/span" className={cn("min-w-8 text-center font-semibold tabular-nums", size === "lg" && "min-w-10 text-lg")} aria-live="polite">
        {value}
      </span>
      <button
        data-ui="store/QuantityStepper/button-increase-quantity"
        type="button"
        aria-disabled={atMax}
        className={cn(btn, atMax && "opacity-40 hover:bg-transparent")}
        onClick={handleIncrease}
        aria-label="Increase quantity"
      >
        <PlusIcon className="size-3.5" />
      </button>
    </div>
  )
}

"use client"

import { MinusIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import styles from "./store-widgets.module.css"

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
  const [popTick, setPopTick] = useState(0)
  const atMax = value >= max
  const btn = cn(styles.stepBtn, size === "sm" ? styles.stepBtnSm : styles.stepBtnLg)

  const unit = max === 1 ? "item" : "items"

  const handleDecrease = () => {
    setPopTick((t) => t + 1)
    onChange(value - 1)
  }

  const handleIncrease = () => {
    if (value >= max) {
      toast.info(`Only ${max} ${unit} available in stock.`, { id: `max-qty-${label}` })
      return
    }
    const next = value + 1
    setPopTick((t) => t + 1)
    onChange(next)
    if (next >= max) {
      toast.info(`Only ${max} ${unit} available in stock.`, { id: `max-qty-${label}` })
    }
  }

  return (
    <div
      role="group"
      aria-label={`Quantity for ${label}`}
      className={cn(styles.stepperGroup, size === "lg" && styles.stepperGroupLg, className)}
    >
      <button type="button" className={btn} onClick={handleDecrease} disabled={value <= 1} aria-label="Decrease quantity">
        <MinusIcon className={styles.stepSvg} />
      </button>
      <span className={cn(styles.qtyReadout, size === "lg" && styles.qtyReadoutLg)} aria-live="polite">
        <span key={popTick} className={cn(styles.qtyValueInner, popTick > 0 && styles.qtyValuePop)}>
          {value}
        </span>
      </span>
      <button

        type="button"
        aria-disabled={atMax}
        className={cn(btn, atMax && styles.stepBtnAtMax)}
        onClick={handleIncrease}
        aria-label="Increase quantity"
      >
        <PlusIcon className={styles.stepSvg} />
      </button>
    </div>
  )
}

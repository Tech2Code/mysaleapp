"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { describedBy, FieldShell, FIELD_HEIGHT, type FieldSize } from "./field-shell"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function formatDisplayDate(isoDate?: string): string {
  if (!isoDate) return ""
  const parts = isoDate.split("-")
  if (parts.length !== 3) return isoDate
  const y = Number(parts[0])
  const m = Number(parts[1]) - 1
  const d = Number(parts[2])
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 0 || m >= 12) return isoDate
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${d} ${shortMonths[m]} ${y}`
}

function getTodayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseYearMonth(iso?: string): { year: number; month: number } | null {
  if (!iso) return null
  const [y, m] = iso.split("-").map(Number)
  if (!Number.isNaN(y) && y > 1900 && !Number.isNaN(m) && m >= 1 && m <= 12) {
    return { year: y, month: m - 1 }
  }
  return null
}

export type DateFieldProps = {
  label: string
  hideLabel?: boolean
  error?: string
  hint?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  onBlur?: () => void
  name?: string
  id?: string
  min?: string
  max?: string
  disabled?: boolean
  fieldSize?: FieldSize
  placeholder?: string
  className?: string
  containerClassName?: string
  noErrorSpace?: boolean
  clearable?: boolean
}

/**
 * Custom accessible, responsive DatePicker component.
 * Uses Base UI Popover with automatic collision handling to prevent viewport clipping.
 */
export function DateField({
  label,
  hideLabel,
  error,
  hint,
  value: controlledValue,
  defaultValue = "",
  onChange,
  onBlur,
  name,
  id: explicitId,
  min,
  max,
  disabled = false,
  fieldSize = "lg",
  placeholder = "Select date",
  className,
  containerClassName,
  noErrorSpace,
  clearable = true,
}: DateFieldProps) {
  const generatedId = useId()
  const id = explicitId || generatedId
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
  const [open, setOpen] = useState(false)

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  // Never read the clock synchronously during render (Next.js Cache Components + SSR/client hydration safety).
  const [todayIso, setTodayIso] = useState("")

  const initialParsed = parseYearMonth(value || min)
  const [viewYear, setViewYear] = useState(initialParsed?.year ?? 2026)
  const [viewMonth, setViewMonth] = useState(initialParsed?.month ?? 0)

  useEffect(() => {
    const today = getTodayIso()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- populate client clock after mount
    setTodayIso(today)
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const today = todayIso || getTodayIso()
      if (!todayIso) setTodayIso(today)
      const parsed = parseYearMonth(value || today)
      if (parsed) {
        setViewYear(parsed.year)
        setViewMonth(parsed.month)
      }
    }
    setOpen(nextOpen)
  }

  const handleSelect = (isoDate: string) => {
    if (disabled) return
    if (controlledValue === undefined) setUncontrolledValue(isoDate)
    onChange?.(isoDate)
    setOpen(false)
  }

  const handleClear = () => {
    if (disabled) return
    if (controlledValue === undefined) setUncontrolledValue("")
    onChange?.("")
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  // Days in current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) {
      days.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d)
    }
    return days
  }, [viewYear, viewMonth])

  return (
    <FieldShell
      id={id}
      label={label}
      hideLabel={hideLabel}
      error={error}
      hint={hint}
      className={containerClassName}
      noErrorSpace={noErrorSpace}
    >
      {name && <input type="hidden" name={name} value={value || ""} />}
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <div data-ui="form/DateField/div-relative" className="relative">
          <Popover.Trigger
            data-ui="form/DateField/Trigger"
            id={id}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy(id, error, hint)}
            onBlur={onBlur}
            className={cn(
              "flex w-full items-center justify-between rounded-xl border border-input bg-background px-3 text-left text-sm shadow-xs transition-colors outline-none",
              FIELD_HEIGHT[fieldSize],
              clearable && value && !disabled && "pr-14",
              "hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
              error && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
              disabled && "cursor-not-allowed opacity-50",
              className
            )}
          >
            <span data-ui="form/DateField/span-value" className={cn("truncate", !value && "text-muted-foreground")}>
              {value ? formatDisplayDate(value) : placeholder}
            </span>
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Popover.Trigger>
          {clearable && value && !disabled && (
            <button
              data-ui="form/DateField/button-clear"
              type="button"
              aria-label="Clear date"
              onClick={handleClear}
              className="absolute top-1/2 right-8 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          )}

          <Popover.Portal>
            <Popover.Positioner
              side="bottom"
              align="start"
              sideOffset={4}
              className="isolate z-50 outline-none"
            >
              <Popover.Popup
                data-ui="form/DateField/Popover"
                className="z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-2xl backdrop-blur-md outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
              >
                {/* Header: Month / Year + Navigation */}
                <div className="flex items-center justify-between gap-1 pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={prevMonth}
                    aria-label="Previous month"
                    className="size-7 rounded-lg"
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <span className="text-sm font-semibold">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={nextMonth}
                    aria-label="Next month"
                    className="size-7 rounded-lg"
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground py-1 border-y">
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="py-0.5">
                      {day}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 pt-2">
                  {calendarDays.map((day, idx) => {
                    if (day === null) {
                      return <div key={`empty-${idx}`} className="size-8" />
                    }
                    const mStr = String(viewMonth + 1).padStart(2, "0")
                    const dStr = String(day).padStart(2, "0")
                    const iso = `${viewYear}-${mStr}-${dStr}`
                    const isSelected = value === iso
                    const isToday = todayIso === iso
                    const isBeforeMin = min ? iso < min : false
                    const isAfterMax = max ? iso > max : false
                    const isDayDisabled = isBeforeMin || isAfterMax

                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isDayDisabled}
                        onClick={() => handleSelect(iso)}
                        className={cn(
                          "size-8 rounded-full text-xs font-medium transition-colors flex items-center justify-center",
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : isToday
                            ? "border border-primary text-primary font-semibold hover:bg-primary/10"
                            : "hover:bg-muted text-foreground",
                          isDayDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent"
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>

                {/* Footer Quick Actions */}
                <div className="flex items-center justify-between border-t mt-2 pt-2 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const today = todayIso || getTodayIso()
                      const parsed = parseYearMonth(today)
                      if (parsed) {
                        setViewYear(parsed.year)
                        setViewMonth(parsed.month)
                      }
                      handleSelect(today)
                    }}
                    className="h-7 px-2 text-xs text-primary hover:text-primary font-medium"
                  >
                    Today
                  </Button>
                  {value && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </div>
      </Popover.Root>
    </FieldShell>
  )
}

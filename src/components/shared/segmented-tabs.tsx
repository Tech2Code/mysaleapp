"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { type ComponentType, type KeyboardEvent, type SVGProps } from "react"
import { cn } from "@/lib/utils"
import { useScrollableTabs } from "./pill-tabs"
import styles from "./segmented-tabs.module.css"

export type SegmentedTabItem<T extends string = string> = {
  value: T
  label?: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  count?: number
  attention?: boolean
  ariaLabel?: string
  title?: string
}

type SegmentedTabsProps<T extends string> = {
  items: readonly SegmentedTabItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  role?: "tablist" | "group"
  layout?: "equal" | "scroll" | "inline"
  surface?: "card" | "primary"
  shape?: "rounded" | "pill"
  size?: "sm" | "md"
  className?: string
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  role = "group",
  layout = "equal",
  surface = "card",
  shape = "rounded",
  size = "md",
  className,
}: SegmentedTabsProps<T>) {
  const isScroll = layout === "scroll"
  const keys = items.map((item) => item.value)
  const { listRef, itemRefs, scrollEdges, hasOverflow, centerItem, scrollByStep } =
    useScrollableTabs(keys, value, isScroll)

  const handleSelect = (nextValue: T) => {
    if (nextValue === value && isScroll) {
      centerItem(nextValue)
    }
    onChange(nextValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (role !== "tablist") return
    const currentIndex = items.findIndex((item) => item.value === value)
    if (currentIndex < 0) return
    let nextIndex: number | null = null
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % items.length
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + items.length) % items.length
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = items.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    const nextKey = items[nextIndex].value
    handleSelect(nextKey)
    itemRefs.current[nextKey]?.focus({ preventScroll: true })
  }

  const tray = (
    <div
      ref={listRef}
      role={role}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        styles.segmentedTray,
        layout === "equal" && styles.segmentedTrayEqual,
        layout === "scroll" && styles.segmentedTrayScroll,
        layout === "inline" && styles.segmentedTrayInline,
        shape === "pill" && styles.segmentedTrayPill,
        size === "sm" && styles.segmentedTraySm,
        !isScroll && className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(node) => {
              itemRefs.current[item.value] = node
            }}
            type="button"
            role={role === "tablist" ? "tab" : undefined}
            tabIndex={role === "tablist" ? (active ? 0 : -1) : undefined}
            aria-selected={role === "tablist" ? active : undefined}
            aria-pressed={role === "group" ? active : undefined}
            aria-label={item.ariaLabel}
            title={item.title}
            onClick={() => handleSelect(item.value)}
            className={cn(
              styles.segmentBtn,
              layout === "scroll" && styles.segmentBtnScroll,
              shape === "pill" && styles.segmentBtnPill,
              size === "sm" && styles.segmentBtnSm,
              !item.label && styles.segmentBtnIconOnly,
              active && (surface === "primary" ? styles.segmentBtnPrimaryActive : styles.segmentBtnCardActive),
            )}
          >
            {Icon && <Icon className={styles.segmentIcon} aria-hidden="true" />}
            {item.label && <span>{item.label}</span>}
            {typeof item.count === "number" && (
              <span
                className={cn(
                  styles.segmentCount,
                  active
                    ? surface === "primary"
                      ? styles.segmentCountPrimaryActive
                      : styles.segmentCountCardActive
                    : item.attention
                      ? styles.segmentCountAttention
                      : styles.segmentCountDefault,
                )}
              >
                {item.attention && !active && (
                  <span aria-hidden="true" className={styles.attentionDot} />
                )}
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )

  if (!isScroll) return tray

  return (
    <div className={cn(styles.segmentedScrollShell, className)}>
      {hasOverflow && (
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} left`}
          disabled={!scrollEdges.start}
          onClick={() => scrollByStep(-1)}
          className={styles.scrollArrowBtn}
        >
          <ChevronLeftIcon className={styles.scrollArrowIcon} aria-hidden="true" />
        </button>
      )}
      {tray}
      {hasOverflow && (
        <button
          type="button"
          aria-label={`Scroll ${ariaLabel} right`}
          disabled={!scrollEdges.end}
          onClick={() => scrollByStep(1)}
          className={styles.scrollArrowBtn}
        >
          <ChevronRightIcon className={styles.scrollArrowIcon} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

"use client"

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type SVGProps,
} from "react"
import { cn } from "@/lib/utils"
import styles from "./pill-tabs.module.css"

export type PillTabItem<T extends string = string> = {
  value: T
  label: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
  /** Pre-rendered icon element (use this when calling PillTabs from a Server Component). */
  iconNode?: ReactNode
  count?: number
  href?: string
  ariaLabel?: string
}

export function useScrollableTabs<T extends string>(
  keys: readonly T[],
  activeKey: T,
  enabled = true,
) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<Partial<Record<T, HTMLElement | null>>>({})
  const hasMountedRef = useRef(false)
  const hasOverflowRef = useRef(false)
  const [scrollState, setScrollState] = useState({ overflow: false, start: false, end: false })

  const centerItem = useCallback((key: T, instant = false) => {
    const container = listRef.current
    const el = itemRefs.current[key]
    if (!container || !el) return
    const maxScroll = container.scrollWidth - container.clientWidth
    if (maxScroll <= 1) return
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const targetLeft =
      container.scrollLeft +
      (elRect.left - containerRect.left) -
      (containerRect.width - elRect.width) / 2
    const clampedLeft = Math.max(0, Math.min(maxScroll, targetLeft))
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    container.scrollTo({
      left: clampedLeft,
      behavior: instant || prefersReduced ? "auto" : "smooth",
    })
  }, [])

  const firstKey = keys[0]
  const keysSignature = keys.join("\u0000")

  useEffect(() => {
    if (!enabled) return
    const container = listRef.current
    if (!container) return

    // Hysteresis prevents arrow-button mount/unmount from oscillating container width (~88px for two arrows + gaps).
    const ARROW_RESERVE_PX = 92
    let rafId = 0

    const syncScrollState = () => {
      rafId = 0
      const { scrollWidth, clientWidth, scrollLeft } = container
      const maxScroll = scrollWidth - clientWidth
      const nextOverflow = hasOverflowRef.current
        ? scrollWidth > clientWidth - ARROW_RESERVE_PX && maxScroll > 1
        : maxScroll > 2
      hasOverflowRef.current = nextOverflow
      const nextStart = nextOverflow && scrollLeft > 2
      const nextEnd = nextOverflow && scrollLeft < maxScroll - 2
      setScrollState((prev) =>
        prev.overflow === nextOverflow && prev.start === nextStart && prev.end === nextEnd
          ? prev
          : { overflow: nextOverflow, start: nextStart, end: nextEnd },
      )
    }

    const scheduleSync = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(syncScrollState)
    }

    container.addEventListener("scroll", scheduleSync, { passive: true })
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSync) : null
    resizeObserver?.observe(container)
    const mutationObserver =
      typeof MutationObserver !== "undefined" ? new MutationObserver(scheduleSync) : null
    mutationObserver?.observe(container, { childList: true, subtree: true, characterData: true })
    syncScrollState()

    return () => {
      container.removeEventListener("scroll", scheduleSync)
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      if (rafId) window.cancelAnimationFrame(rafId)
    }
  }, [enabled, keysSignature])

  useEffect(() => {
    if (!enabled) return
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      if (activeKey !== firstKey) {
        const raf = window.requestAnimationFrame(() => centerItem(activeKey, true))
        return () => window.cancelAnimationFrame(raf)
      }
      return
    }
    const raf = window.requestAnimationFrame(() => centerItem(activeKey))
    return () => window.cancelAnimationFrame(raf)
  }, [activeKey, centerItem, enabled, firstKey])

  const scrollByStep = useCallback((direction: -1 | 1) => {
    const container = listRef.current
    if (!container) return
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const step = Math.max(160, Math.round(container.clientWidth * 0.6))
    container.scrollBy({
      left: direction * step,
      behavior: prefersReduced ? "auto" : "smooth",
    })
  }, [])

  return {
    listRef,
    itemRefs,
    scrollEdges: { start: scrollState.start, end: scrollState.end },
    hasOverflow: enabled && scrollState.overflow,
    centerItem,
    scrollByStep,
  }
}

type PillTabsProps<T extends string> = {
  items: readonly PillTabItem<T>[]
  value: T
  onChange?: (value: T) => void
  ariaLabel: string
  role?: "tablist" | "group" | "navigation"
  tone?: "solid" | "tint"
  size?: "md" | "sm"
  className?: string
  trailing?: ReactNode
}

export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  role = "tablist",
  tone = "solid",
  size = "md",
  className,
  trailing,
}: PillTabsProps<T>) {
  const keys = items.map((item) => item.value)
  const { listRef, itemRefs, scrollEdges, hasOverflow, centerItem, scrollByStep } =
    useScrollableTabs(keys, value, true)

  const handleSelect = (nextValue: T) => {
    if (nextValue === value) {
      centerItem(nextValue)
    }
    onChange?.(nextValue)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (role !== "tablist" || !onChange) return
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

  const isNav = role === "navigation"
  const listContent = (
    <div
      ref={listRef}
      className={styles.pillTabsTrack}
      role={isNav ? undefined : role}
      aria-label={isNav ? undefined : ariaLabel}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.value === value
        const pillClass = cn(
          styles.pillBtn,
          size === "sm" && styles.pillBtnSm,
          tone === "tint" && styles.pillBtnTint,
          active && (tone === "tint" ? styles.pillBtnTintActive : styles.pillBtnActive),
        )

        if (item.href) {
          return (
            <Link
              key={item.value}
              ref={(node) => {
                itemRefs.current[item.value] = node
              }}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.ariaLabel}
              onClick={() => centerItem(item.value)}
              className={pillClass}
            >
              {Icon ? (
                <Icon className={styles.pillIcon} aria-hidden="true" />
              ) : item.iconNode ? (
                <span className={styles.pillIconWrap} aria-hidden="true">
                  {item.iconNode}
                </span>
              ) : null}
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    styles.pillCount,
                    active && (tone === "tint" ? styles.pillCountTintActive : styles.pillCountActive),
                  )}
                >
                  {item.count}
                </span>
              )}
            </Link>
          )
        }

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
            onClick={() => handleSelect(item.value)}
            className={pillClass}
          >
            {Icon ? (
              <Icon className={styles.pillIcon} aria-hidden="true" />
            ) : item.iconNode ? (
              <span className={styles.pillIconWrap} aria-hidden="true">
                {item.iconNode}
              </span>
            ) : null}
            <span>{item.label}</span>
            {typeof item.count === "number" && (
              <span
                className={cn(
                  styles.pillCount,
                  active && (tone === "tint" ? styles.pillCountTintActive : styles.pillCountActive),
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
      {trailing}
    </div>
  )

  const shellContent = (
    <>
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
      {listContent}
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
    </>
  )

  if (isNav) {
    return (
      <nav aria-label={ariaLabel} className={cn(styles.pillTabsShell, className)}>
        {shellContent}
      </nav>
    )
  }

  return <div className={cn(styles.pillTabsShell, className)}>{shellContent}</div>
}

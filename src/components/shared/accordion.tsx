"use client"

import { ChevronDownIcon } from "lucide-react"
import { Children, cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from "react"
import styles from "./shared.module.css"

type ItemProps = { title: string; children: ReactNode; defaultOpen?: boolean; name?: string }

/**
 * Collapsible section built on the native <details> element: keyboard accessible, works without JavaScript.
 * Items inside an <Accordion> share a `name`, so the browser keeps only one open at a time.
 */
export function AccordionItem({ title, children, defaultOpen = false, name }: ItemProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details

      name={name}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className={styles.accordionDetails}
    >
      <summary className={styles.accordionSummary}>
        {title}
        <ChevronDownIcon className={styles.chevronIcon} aria-hidden />
      </summary>
      <div className={styles.accordionBody}>{children}</div>
    </details>
  )
}

/** One item open at a time: opening one closes the other. */
export function Accordion({ children }: { children: ReactNode }) {
  const group = useId()
  const items = Children.toArray(children)
  const firstElementIndex = items.findIndex((child) => isValidElement<ItemProps>(child))
  return (
    <div className={styles.accordionBox}>
      {items.map((child, i) =>
        isValidElement<ItemProps>(child)
          ? cloneElement(child as ReactElement<ItemProps>, {
              name: group,
              defaultOpen: child.props.defaultOpen ?? i === firstElementIndex,
            })
          : child
      )}
    </div>
  )
}

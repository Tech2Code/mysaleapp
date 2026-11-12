"use client"

import type { HTMLMotionProps } from "motion/react"
import * as m from "motion/react-m"

const ease = [0.22, 1, 0.36, 1] as const

// Translate-only on purpose: an opacity-0 start state is rendered into the server HTML, which would leave
// the content invisible until hydration (and blank for anyone whose JS is slow or blocked). Content is
// always visible; it only slides into place once the motion features have loaded.

/** Slides children in when they scroll into view (once). */
export function FadeIn({
  delay = 0,
  y = 12,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <m.div data-ui="shared/FadeIn"
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease, delay }}
      {...props}
    />
  )
}

/** Container that reveals its <StaggerItem> children one after another. */
export function Stagger({ stagger = 0.05, ...props }: HTMLMotionProps<"div"> & { stagger?: number }) {
  return (
    <m.div data-ui="shared/Stagger"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-30px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...props}
    />
  )
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return (
    <m.div data-ui="shared/StaggerItem"
      variants={{
        hidden: { y: 12 },
        show: { y: 0, transition: { duration: 0.38, ease } },
      }}
      {...props}
    />
  )
}

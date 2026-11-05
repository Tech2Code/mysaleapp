"use client"

import { motion, type HTMLMotionProps } from "motion/react"

const ease = [0.22, 1, 0.36, 1] as const

/** Fades + slides children in when they scroll into view (once). */
export function FadeIn({
  delay = 0,
  y = 24,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div data-ui="shared/FadeIn"
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease, delay }}
      {...props}
    />
  )
}

/** Container that reveals its <StaggerItem> children one after another. */
export function Stagger({ stagger = 0.07, ...props }: HTMLMotionProps<"div"> & { stagger?: number }) {
  return (
    <motion.div data-ui="shared/Stagger"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      {...props}
    />
  )
}

export function StaggerItem(props: HTMLMotionProps<"div">) {
  return (
    <motion.div data-ui="shared/StaggerItem"
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } },
      }}
      {...props}
    />
  )
}

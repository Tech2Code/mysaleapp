"use client"

import styles from "./shared.module.css"

/**
 * Multi-stage animated emerald checkmark micro-interaction (expanding halo ring +
 * spring-overshoot gradient badge + sequenced SVG ring sweep & checkmark stroke draw).
 * Used inside the busy overlay's centre pill on sign-in, checkout, and account actions.
 */
export function SuccessTick() {
  return (
    <span aria-hidden="true" className={styles.successTickWrap}>
      <span className={styles.successTickHalo} />
      <span className={styles.successTickCircle}>
        <svg viewBox="0 0 24 24" className={styles.tickSvg} fill="none">
          <circle
            className={styles.tickRingPath}
            cx="12"
            cy="12"
            r="9.2"
            pathLength={1}
          />
          <path
            className={styles.tickCheckPath}
            d="M7.2 12.5L10.4 15.7L16.8 8.7"
            pathLength={1}
          />
        </svg>
      </span>
    </span>
  )
}

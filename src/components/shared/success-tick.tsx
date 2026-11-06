"use client"

/** Green circle with a tick that pops in and draws itself. Used inside the busy overlay's centre pill. */
export function SuccessTick() {
  return (
    <span data-ui="shared/SuccessTick" aria-hidden className="tick-pop grid size-7 place-items-center rounded-full bg-success-solid">
      <svg data-ui="shared/SuccessTick/svg" viewBox="0 0 24 24" className="size-4.5" fill="none">
        <path
          className="tick-draw"
          d="M6 12.5 L10.5 17 L18 8"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
        />
      </svg>
    </span>
  )
}

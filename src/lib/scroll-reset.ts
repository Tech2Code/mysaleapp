/**
 * When should a navigation put the reader back at the top of the page?
 * Pure, so the rule can be tested; `components/shared/scroll-reset.tsx` applies it.
 *
 *  - only when the PATH changed (a filter or `?query` change on the same page keeps the position)
 *  - not for back / forward: the browser puts the reader back where they were
 *  - not for `#hash` links: the browser scrolls to that element
 */
export function shouldResetScroll(input: { previousPath: string; nextPath: string; viaHistory: boolean; hash: string }): boolean {
  if (input.previousPath === input.nextPath) return false
  if (input.viaHistory) return false
  if (input.hash) return false
  return true
}

/** How long the page is held at the top while the new page streams in and changes height. */
export const SCROLL_HOLD = { stableMs: 400, maxMs: 2500, pollMs: 50 } as const

/**
 * Should the hold on the top of the page end?
 * It ends once the document height has been stable for `stableMs`, or after the hard cap `maxMs`.
 */
export function holdFinished(input: { now: number; startedAt: number; lastHeightChangeAt: number }): boolean {
  return input.now - input.lastHeightChangeAt >= SCROLL_HOLD.stableMs || input.now - input.startedAt >= SCROLL_HOLD.maxMs
}

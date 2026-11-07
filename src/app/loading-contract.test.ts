import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * Loading-state contract (see "Loading skeletons" in CLAUDE.md).
 *
 * A skeleton is the REAL page rendered with placeholder data inside <Skeletonize>
 * (src/components/shared/skeletonize.tsx), so it cannot drift from the UI. This test makes the
 * rule mechanical:
 *   1. every dynamic page has its own loading.tsx;
 *   2. a loading.tsx only wires placeholders into the page's own view (no markup, no sizes);
 *   3. nobody hand-builds skeleton blocks anywhere in src.
 */

const SRC = join(process.cwd(), "src")
const APP = join(SRC, "app")

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const rel = (p: string) => relative(SRC, p).split(sep).join("/")
const read = (p: string) => readFileSync(p, "utf8")
const dirOf = (p: string) => p.slice(0, p.lastIndexOf(sep))
const importsOf = (code: string) => new Set([...code.matchAll(/from\s+["'](@\/components\/[^"']+)["']/g)].map((m) => m[1]))

const appFiles = walk(APP)
const pages = appFiles.filter((f) => /[\\/]page\.tsx$/.test(f))
const loadings = appFiles.filter((f) => /[\\/]loading\.tsx$/.test(f))

/** Redirect-only pages render nothing, so they need no skeleton. */
const isRedirectOnly = (code: string) => /\bredirect\(/.test(code) && !/\bawait\b/.test(code)

/** A page is dynamic when it reads request data or fetches (async / await / params / searchParams). */
const isDynamic = (code: string) => /\basync\s+function\b/.test(code) || /\bawait\b/.test(code) || /\bsearchParams\b/.test(code) || /\bparams\b/.test(code)

/** Pages that are dynamic but deliberately have no loading.tsx (pre-login screens that render instantly). Keep this list tiny. */
const NO_LOADING_NEEDED = new Set<string>([
  "app/admin/login/page.tsx",
  "app/admin/forgot-password/page.tsx",
  "app/admin/reset-password/page.tsx",
  "app/offline/page.tsx",
])

describe("loading.tsx coverage", () => {
  it("every dynamic page has its own loading.tsx", () => {
    const missing = pages
      .filter((p) => {
        const code = read(p)
        return isDynamic(code) && !isRedirectOnly(code) && !NO_LOADING_NEEDED.has(rel(p))
      })
      .filter((p) => !loadings.some((l) => dirOf(l) === dirOf(p)))
      .map(rel)
    expect(missing, `add a loading.tsx next to each of these pages (render the page's view with placeholders inside <Skeletonize>)`).toEqual([])
  })

  it("the allow-list only names pages that exist", () => {
    const existing = new Set(pages.map(rel))
    expect([...NO_LOADING_NEEDED].filter((p) => !existing.has(p))).toEqual([])
  })
})

describe("loading.tsx content", () => {
  it.each(loadings.map((l) => [rel(l), l]))("%s only wires placeholders into the page's view", (_name, file) => {
    const code = read(file)

    // 1. uses the shared mechanism
    expect(code, "must render <Skeletonize>").toContain("<Skeletonize")
    expect(code, "must import Skeletonize").toMatch(/import\s*\{[^}]*\bSkeletonize\b[^}]*\}\s*from\s*["']@\/components\/shared\/skeletonize["']/)

    // 2. no hand-built layout: no raw HTML elements, classes or inline styles
    expect(code, "no raw HTML elements in loading.tsx (render the page's view component)").not.toMatch(/<[a-z][a-z0-9-]*[\s>/]/)
    expect(code, "no className in loading.tsx").not.toMatch(/\bclassName\s*=/)
    expect(code, "no inline style in loading.tsx").not.toMatch(/\bstyle\s*=/)
    expect(code, "no hard-coded sizes").not.toMatch(/\b(?:h|w|size|min-h|max-w)-\d/)

    // 3. renders the same view as the page next to it, so the two cannot drift
    const pagePath = join(dirOf(file), "page.tsx")
    let page: string | null = null
    try {
      page = read(pagePath)
    } catch {
      // a loading.tsx without a sibling page (shared segment) has nothing to compare with
    }
    if (page && !isRedirectOnly(page)) {
      const shared = [...importsOf(code)].filter((i) => importsOf(page).has(i))
      expect(shared, "loading.tsx must import the same view component as page.tsx").not.toEqual([])
    }
  })
})

describe("no hand-built skeletons", () => {
  const sources = walk(SRC).filter((f) => /\.(tsx?|css)$/.test(f) && !/\.test\.tsx?$/.test(f))

  it("no skeleton component files other than Skeletonize", () => {
    const offenders = sources.filter((f) => /skeleton/i.test(f.split(sep).pop() ?? "") && !f.endsWith(`${sep}skeletonize.tsx`)).map(rel)
    expect(offenders).toEqual([])
  })

  it("nothing paints pulsing placeholder blocks by hand", () => {
    const offenders = sources
      .filter((f) => !f.endsWith(`${sep}skeletonize.tsx`) && f.endsWith(".tsx"))
      .filter((f) => {
        const code = read(f)
        return (
          /from\s+["']@\/components\/ui\/skeleton["']/.test(code) ||
          /data-slot=["']skeleton["']/.test(code) ||
          code.split("\n").some((line) => /animate-pulse/.test(line) && /\bbg-(muted|secondary|accent)\b/.test(line)) ||
          /fallback=\{\s*<(div|span|section|ul)\b/.test(code)
        )
      })
      .map(rel)
    expect(offenders, "build the loading state with <Skeletonize> around the real component").toEqual([])
  })

  it("the Skeletonize CSS is in globals.css", () => {
    const css = read(join(APP, "globals.css"))
    expect(css).toContain("[data-skeleton]")
    expect(css).toContain("prefers-reduced-motion")
    const component = read(join(SRC, "components/shared/skeletonize.tsx"))
    expect(component).toContain("data-skeleton")
    expect(component).toContain("inert")
    expect(component).toContain("aria-busy")
  })
})

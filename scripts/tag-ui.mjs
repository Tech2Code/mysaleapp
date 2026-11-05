// Adds a `data-ui="area/ComponentName"` attribute to the root element of every component.
// Run `npm run ui:tag` after adding components. Safe to re-run (existing ids are kept).
// In dev, press Alt+I (or use the "UI ids" button) to see/copy these ids. They are stripped from production builds.
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const SRC = path.resolve("src")
const SKIP_DIRS = new Set([path.join(SRC, "components", "ui")])
const SKIP_FILES = /(opengraph-image|apple-icon|icon|brand-image|json-ld|route).tsx$/ // image/SEO output, not UI
const PAGE_FILES = new Set(["page.tsx", "layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx"])

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(p)) walk(p, out)
    } else if (e.name.endsWith(".tsx") && !SKIP_FILES.test(e.name)) out.push(p)
  }
  return out
}

/** "components/store/header.tsx" -> area "store"; "app/(store)/cart/page.tsx" -> "page:/cart" */
function idFor(file, name, isDefault) {
  const rel = path.relative(SRC, file).split(path.sep)
  if (rel[0] === "app") {
    const base = rel[rel.length - 1]
    if (!PAGE_FILES.has(base)) return null
    const route = rel.slice(1, -1).filter((s) => !s.startsWith("(")).join("/")
    const page = `${base.replace(".tsx", "")}:/${route}`
    return isDefault ? page : `${page}#${name}` // helper components inside a page file
  }
  const area = rel[0] === "components" ? rel[1] : rel[0]
  return `${area}/${name}`
}

function rootElements(expr, out) {
  if (!expr) return
  if (ts.isParenthesizedExpression(expr)) return rootElements(expr.expression, out)
  if (ts.isConditionalExpression(expr)) {
    rootElements(expr.whenTrue, out)
    rootElements(expr.whenFalse, out)
  } else if (ts.isJsxElement(expr)) out.push(expr.openingElement)
  else if (ts.isJsxSelfClosingElement(expr)) out.push(expr)
}

function returnsOf(node, out) {
  ts.forEachChild(node, (child) => {
    if (ts.isFunctionLike(child)) return // nested callbacks are not the component's own return
    if (ts.isReturnStatement(child)) rootElements(child.expression, out)
    returnsOf(child, out)
  })
}

const isDom = (tag) => {
  const t = tag.getText()
  return /^[a-z]/.test(t) || t.startsWith("motion.")
}

let changed = 0
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const inserts = []
  const replaces = []

  const visitFn = (name, fn) => {
    const isDefault = ts.isFunctionDeclaration(fn) && fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const id = idFor(file, name, Boolean(isDefault))
    if (!id || !fn.body) return
    const roots = []
    if (ts.isBlock(fn.body)) returnsOf(fn.body, roots)
    else rootElements(fn.body, roots) // arrow function returning JSX directly
    for (const el of roots) {
      if (!isDom(el.tagName)) continue
      const existing = el.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === "data-ui")
      if (existing) {
        // keep ids in sync with the naming rule (only literal ids written by this script are touched)
        const init = existing.initializer
        if (init && ts.isStringLiteral(init) && init.text !== id) replaces.push({ start: init.getStart(), end: init.getEnd(), text: `"${id}"` })
        continue
      }
      inserts.push({ pos: el.tagName.getEnd(), text: ` data-ui="${id}"` })
    }
  }

  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) {
      const name = st.name?.text ?? "Default"
      if (/^[A-Z]/.test(name) || (st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword))) visitFn(name, st)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !/^[A-Z]/.test(d.name.text) || !d.initializer) continue
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) visitFn(d.name.text, d.initializer)
      }
    }
  }

  if (!inserts.length && !replaces.length) continue
  const edits = [
    ...inserts.map((i) => ({ start: i.pos, end: i.pos, text: i.text })),
    ...replaces,
  ].sort((a, b) => b.start - a.start)
  let out = text
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  fs.writeFileSync(file, out)
  changed += edits.length
}
console.log(`ui:tag updated ${changed} id(s)`)

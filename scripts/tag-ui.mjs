// Adds a `data-ui` id to EVERY element in the app's components and pages, so "change this part" can name it exactly.
//
//   root element of a component   data-ui="store/Header"
//   any element inside it         data-ui="store/Header/button-open-cart", "store/Header/div-flex-2", ...
//   pages                         data-ui="page:/admin/orders", inner: "page:/admin/orders/h1-orders"
//
// Run `npm run ui:tag` after adding or changing components. Safe to re-run: ids are recomputed and kept in sync.
// In dev, press Alt+I (or use the corner button) to see/copy them. They are stripped from production builds.
//
// Ids are built from: the component name + the tag + a hint (aria-label, visible text, id/name/placeholder,
// or the layout class like grid/flex) + a counter when the same name repeats inside one component.
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const SRC = path.resolve("src")
const SKIP_DIRS = new Set([path.join(SRC, "components", "ui")])
const SKIP_FILES = /(opengraph-image|apple-icon|icon|brand-image|json-ld|route|ui-inspector)\.tsx$/ // image/SEO output, dev tool
const PAGE_FILES = new Set(["page.tsx", "layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx"])

/** Lower-case DOM tags that are never tagged (document level or SVG internals). */
const SKIP_TAGS = new Set([
  "html", "body", "head", "script", "style", "meta", "title", "noscript", "br", "wbr",
  "path", "g", "circle", "ellipse", "line", "rect", "polyline", "polygon", "defs", "linearGradient", "radialGradient",
  "stop", "clipPath", "mask", "use", "tspan", "text", "filter", "feGaussianBlur",
])
/** Our own / library components that pass extra props down to a DOM element, so the id lands in the page. */
const COMPONENT_TAGS = new Set([
  "Link", "ScrollLink", "Image", "Button", "Badge", "Skeleton", "Label",
  "Table", "TableHeader", "TableBody", "TableRow", "TableHead", "TableCell",
  "SheetContent", "DialogContent", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuTrigger", "SheetTrigger", "DialogTrigger",
])
const TEXT_HINT_TAGS = new Set(["button", "a", "label", "legend", "option", "th", "h1", "h2", "h3", "h4", "h5", "h6", "Link", "ScrollLink", "Button", "Badge", "TableHead"])
const LAYOUT_TOKENS = ["grid", "inline-flex", "flex", "absolute", "fixed", "sticky", "relative", "hidden"]

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

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 22)

function stringOf(init) {
  if (!init) return null
  if (ts.isStringLiteral(init)) return init.text
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text
  }
  return null
}

const attrOf = (el, name) => {
  const a = el.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === name)
  return a ? { attr: a, value: stringOf(a.initializer) } : null
}

function hintFor(opening, element) {
  const tag = opening.tagName.getText()
  const aria = attrOf(opening, "aria-label")?.value
  if (aria) return slug(aria)
  if (TEXT_HINT_TAGS.has(tag) && element && ts.isJsxElement(element)) {
    for (const c of element.children) {
      if (ts.isJsxText(c) && c.text.trim()) return slug(c.text.trim())
      if (ts.isJsxExpression(c) && c.expression && (ts.isStringLiteral(c.expression) || ts.isNoSubstitutionTemplateLiteral(c.expression))) return slug(c.expression.text)
    }
  }
  for (const n of ["id", "name", "htmlFor", "placeholder"]) {
    const v = attrOf(opening, n)?.value
    if (v) return slug(v)
  }
  const type = attrOf(opening, "type")?.value
  if (type && tag === "input") return slug(type)
  const cls = attrOf(opening, "className")?.value
  if (cls) {
    const tokens = cls.split(/\s+/)
    const hit = LAYOUT_TOKENS.find((t) => tokens.includes(t))
    if (hit) return hit
  }
  return ""
}

/** The element(s) a component function returns directly (its "root"). */
function rootElements(expr, out) {
  if (!expr) return
  if (ts.isParenthesizedExpression(expr)) return rootElements(expr.expression, out)
  if (ts.isConditionalExpression(expr)) {
    rootElements(expr.whenTrue, out)
    rootElements(expr.whenFalse, out)
  } else if (ts.isJsxElement(expr)) out.add(expr.openingElement)
  else if (ts.isJsxSelfClosingElement(expr)) out.add(expr)
}
function returnsOf(node, out) {
  ts.forEachChild(node, (child) => {
    if (ts.isFunctionLike(child)) return
    if (ts.isReturnStatement(child)) rootElements(child.expression, out)
    returnsOf(child, out)
  })
}

const isEligible = (tag) => (/^[a-z]/.test(tag) ? !SKIP_TAGS.has(tag) : tag.startsWith("motion.") || COMPONENT_TAGS.has(tag))

let changed = 0
for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const edits = []

  const visitFn = (name, fn) => {
    const isDefault = ts.isFunctionDeclaration(fn) && fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const compId = idFor(file, name, Boolean(isDefault))
    if (!compId || !fn.body) return

    const roots = new Set()
    if (ts.isBlock(fn.body)) returnsOf(fn.body, roots)
    else rootElements(fn.body, roots)

    const seen = new Map()
    const visit = (node) => {
      const opening = ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null
      if (opening) {
        const tag = opening.tagName.getText()
        if (isEligible(tag)) {
          let id = compId
          if (!roots.has(opening)) {
            const hint = hintFor(opening, ts.isJsxOpeningElement(opening) ? opening.parent : null)
            const base = `${tag.replace("motion.", "m-")}${hint ? `-${hint}` : ""}`
            const n = (seen.get(base) ?? 0) + 1
            seen.set(base, n)
            id = `${compId}/${base}${n > 1 ? `-${n}` : ""}`
          }
          const existing = attrOf(opening, "data-ui")
          if (existing) {
            const init = existing.attr.initializer
            if (init && ts.isStringLiteral(init) && init.text !== id) edits.push({ start: init.getStart(), end: init.getEnd(), text: `"${id}"` })
          } else {
            edits.push({ start: opening.tagName.getEnd(), end: opening.tagName.getEnd(), text: ` data-ui="${id}"` })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(fn.body)
  }

  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st)) {
      const name = st.name?.text ?? "Default"
      if (/^[A-Z]/.test(name) || st.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) visitFn(name, st)
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !/^[A-Z]/.test(d.name.text) || !d.initializer) continue
        if (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) visitFn(d.name.text, d.initializer)
      }
    }
  }

  if (!edits.length) continue
  edits.sort((a, b) => b.start - a.start)
  let out = text
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end)
  fs.writeFileSync(file, out)
  changed += edits.length
}
console.log(`ui:tag updated ${changed} id(s)`)

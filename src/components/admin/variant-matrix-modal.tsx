"use client"

import { PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MAX_VARIANTS } from "@/features/products/schema"
import styles from "./variant-matrix-modal.module.css"

export type VariantFormRow = {
  id: string
  label: string
  options?: Record<string, string>
  price: number | string
  compareAtPrice?: number | string | null
  stock: number | string
  sku?: string | null
}

type OptionGroup = {
  id: string
  name: string
  values: string[]
  draftInput: string
}

const MAX_OPTION_GROUPS = 3

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function groupsFromVariants(variants: VariantFormRow[]): OptionGroup[] {
  const order: string[] = []
  const map = new Map<string, string[]>()
  for (const v of variants) {
    if (v.options && Object.keys(v.options).length > 0) {
      for (const [k, val] of Object.entries(v.options)) {
        const key = k.trim()
        const cleanVal = val.trim()
        if (!key || !cleanVal) continue
        if (!map.has(key)) {
          order.push(key)
          map.set(key, [])
        }
        const list = map.get(key)!
        if (!list.includes(cleanVal)) list.push(cleanVal)
      }
    } else if (v.label.trim()) {
      const key = "Option"
      if (!map.has(key)) {
        order.push(key)
        map.set(key, [])
      }
      const list = map.get(key)!
      if (!list.includes(v.label.trim())) list.push(v.label.trim())
    }
  }
  return order.map((name, i) => ({
    id: `grp-${i}-${name.toLowerCase()}`,
    name,
    values: map.get(name) ?? [],
    draftInput: "",
  }))
}

function comboSignature(options: Record<string, string>): string {
  return Object.entries(options)
    .map(([k, v]) => `${k.toLowerCase()}=${v.toLowerCase()}`)
    .sort()
    .join("|")
}

function buildMatrixFromGroups(
  groups: OptionGroup[],
  existing: VariantFormRow[],
  defaultPrice: number
): VariantFormRow[] {
  const activeGroups = groups.filter((g) => g.name.trim() && g.values.length > 0)
  if (activeGroups.length === 0) return []

  const existingBySig = new Map<string, VariantFormRow>()
  const existingByLabel = new Map<string, VariantFormRow>()
  for (const row of existing) {
    if (row.options && Object.keys(row.options).length > 0) {
      existingBySig.set(comboSignature(row.options), row)
    }
    if (row.label.trim()) existingByLabel.set(row.label.trim().toLowerCase(), row)
  }

  let combos: Record<string, string>[] = [{}]
  for (const g of activeGroups) {
    const key = g.name.trim()
    const next: Record<string, string>[] = []
    for (const c of combos) {
      for (const val of g.values) {
        next.push({ ...c, [key]: val })
        if (next.length >= MAX_VARIANTS) break
      }
      if (next.length >= MAX_VARIANTS) break
    }
    combos = next
  }

  return combos.slice(0, MAX_VARIANTS).map((opts) => {
    const label = activeGroups.map((g) => opts[g.name.trim()]).join(" / ")
    const match = existingBySig.get(comboSignature(opts)) ?? existingByLabel.get(label.toLowerCase())
    if (match) {
      return { ...match, label, options: opts }
    }
    return {
      id: makeId("v"),
      label,
      options: opts,
      price: defaultPrice >= 1 ? defaultPrice : 499,
      compareAtPrice: "",
      stock: 5,
      sku: "",
    }
  })
}

export function VariantMatrixModal({
  open,
  onOpenChange,
  initialVariants,
  defaultPrice,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialVariants: VariantFormRow[]
  defaultPrice: number
  onSave: (variants: VariantFormRow[]) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent mobileFullScreen className={styles.matrixDialog}>
        {open && (
          <VariantMatrixInner
            initialVariants={initialVariants}
            defaultPrice={defaultPrice}
            onClose={() => onOpenChange(false)}
            onSave={(next) => {
              onSave(next)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function VariantMatrixInner({
  initialVariants,
  defaultPrice,
  onClose,
  onSave,
}: {
  initialVariants: VariantFormRow[]
  defaultPrice: number
  onClose: () => void
  onSave: (variants: VariantFormRow[]) => void
}) {
  const [groups, setGroups] = useState<OptionGroup[]>(() => groupsFromVariants(initialVariants))
  const [rows, setRows] = useState<VariantFormRow[]>(() => initialVariants)
  const [bulkScope, setBulkScope] = useState<string>("all")
  const [bulkPrice, setBulkPrice] = useState(defaultPrice >= 1 ? String(defaultPrice) : "")
  const [bulkCompare, setBulkCompare] = useState("")
  const [bulkStock, setBulkStock] = useState("5")
  const [priceRuleGroup, setPriceRuleGroup] = useState<string>("none")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const activeGroups = groups.filter((g) => g.name.trim() && g.values.length > 0)
  const effectiveRuleGroup = activeGroups.some((g) => g.name.trim() === priceRuleGroup) ? priceRuleGroup : "none"

  const syncGroupsAndMatrix = (nextGroups: OptionGroup[]) => {
    setGroups(nextGroups)
    setRows((prev) => buildMatrixFromGroups(nextGroups, prev, defaultPrice))
    setErrorMsg(null)
  }

  const applyTemplate = (preset: { name: string; values: string[] }[]) => {
    const nextGroups: OptionGroup[] = preset.map((p, idx) => ({
      id: makeId(`grp-${idx}`),
      name: p.name,
      values: [...p.values],
      draftInput: "",
    }))
    syncGroupsAndMatrix(nextGroups)
  }

  const addGroup = () => {
    if (groups.length >= MAX_OPTION_GROUPS) return
    const used = new Set(groups.map((g) => g.name.trim().toLowerCase()))
    const suggestion = !used.has("color") ? "Color" : !used.has("size") ? "Size" : "Material"
    setGroups((prev) => [...prev, { id: makeId("grp"), name: suggestion, values: [], draftInput: "" }])
  }

  const removeGroup = (groupId: string) => {
    const nextGroups = groups.filter((g) => g.id !== groupId)
    syncGroupsAndMatrix(nextGroups)
  }

  const updateGroupName = (groupId: string, nextName: string) => {
    const nextGroups = groups.map((g) => (g.id === groupId ? { ...g, name: nextName } : g))
    syncGroupsAndMatrix(nextGroups)
  }

  const commitGroupValues = (groupId: string, rawText: string) => {
    const parts = rawText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const nextGroups = groups.map((g) => {
      if (g.id !== groupId) return g
      const nextVals = [...g.values]
      for (const p of parts) {
        if (!nextVals.some((x) => x.toLowerCase() === p.toLowerCase())) {
          nextVals.push(p.slice(0, 40))
        }
      }
      return { ...g, values: nextVals, draftInput: "" }
    })
    syncGroupsAndMatrix(nextGroups)
  }

  const removeGroupValue = (groupId: string, value: string) => {
    const nextGroups = groups.map((g) =>
      g.id === groupId ? { ...g, values: g.values.filter((v) => v !== value) } : g
    )
    syncGroupsAndMatrix(nextGroups)
  }

  const applyBulk = () => {
    const p = bulkPrice.trim() !== "" ? Number(bulkPrice) : null
    const c = bulkCompare.trim() !== "" ? Number(bulkCompare) : null
    const s = bulkStock.trim() !== "" ? Number(bulkStock) : null
    const [scopeKey, scopeVal] = bulkScope === "all" ? [null, null] : bulkScope.split("::")
    setRows((prev) =>
      prev.map((row) => {
        if (scopeKey && scopeVal && row.options?.[scopeKey] !== scopeVal) return row
        return {
          ...row,
          ...(p !== null && Number.isFinite(p) && p >= 1 ? { price: p } : {}),
          ...(c !== null && Number.isFinite(c) && c >= 1 ? { compareAtPrice: c } : {}),
          ...(s !== null && Number.isFinite(s) && s >= 0 ? { stock: Math.trunc(s) } : {}),
        }
      })
    )
    setErrorMsg(null)
  }

  const applyPriceForOptionValue = (groupName: string, value: string, field: "price" | "compareAtPrice" | "stock", rawVal: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.options?.[groupName] !== value) return row
        return { ...row, [field]: rawVal }
      })
    )
    setErrorMsg(null)
  }

function serializeVariantsForDiff(list: VariantFormRow[]): string {
  return JSON.stringify(
    list.map((r) => ({
      id: r.id,
      label: r.label.trim(),
      options: r.options ?? null,
      price: String(r.price ?? "").trim(),
      compareAtPrice: r.compareAtPrice == null ? "" : String(r.compareAtPrice).trim(),
      stock: String(r.stock ?? "").trim(),
      sku: typeof r.sku === "string" ? r.sku.trim() : "",
    }))
  )
}

  const handleSave = () => {
    // 1. Validate option groups (no blank group name, no duplicate group names, no empty values)
    const seenGroupNames = new Set<string>()
    for (const g of groups) {
      const gName = g.name.trim()
      if (!gName) {
        setErrorMsg("Enter a name for every option group (e.g. Color or Size), or remove the blank group.")
        return
      }
      const lower = gName.toLowerCase()
      if (seenGroupNames.has(lower)) {
        setErrorMsg(`Duplicate option group "${gName}" — each option group must have a unique name.`)
        return
      }
      seenGroupNames.add(lower)
      if (g.values.length === 0) {
        setErrorMsg(`Add at least one value for "${gName}" (type a value and press Enter), or remove this group.`)
        return
      }
    }

    // 2. Prevent saving empty variants when starting from empty
    if (rows.length === 0) {
      if (initialVariants.length === 0) {
        setErrorMsg("Add at least one option group and value (or pick a quick template above) before saving.")
        return
      }
      onSave([])
      return
    }

    // 3. Prevent saving when nothing changed
    if (!hasChanges) {
      setErrorMsg("No changes made yet. Edit a price, stock, or option before saving.")
      return
    }

    // 4. Validate every combination row
    for (const r of rows) {
      const price = Number(r.price)
      const stock = Number(r.stock)
      const compare = r.compareAtPrice === "" || r.compareAtPrice == null ? null : Number(r.compareAtPrice)
      if (!r.label.trim()) {
        setErrorMsg("Every combination must have a label.")
        return
      }
      if (!Number.isFinite(price) || price < 1) {
        setErrorMsg(`Enter a selling price of at least ₹1 for "${r.label}".`)
        return
      }
      if (compare !== null && (!Number.isFinite(compare) || compare <= price)) {
        setErrorMsg(`MRP must be higher than selling price for "${r.label}".`)
        return
      }
      if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
        setErrorMsg(`Enter a valid whole stock number (0 or more) for "${r.label}".`)
        return
      }
    }
    onSave(
      rows.map((r) => ({
        id: r.id,
        label: r.label.trim(),
        ...(r.options && Object.keys(r.options).length > 0 ? { options: r.options } : {}),
        price: Number(r.price),
        compareAtPrice: r.compareAtPrice === "" || r.compareAtPrice == null ? "" : Number(r.compareAtPrice),
        stock: Math.trunc(Number(r.stock)),
        sku: typeof r.sku === "string" ? r.sku.trim() : "",
      }))
    )
  }

  const hasChanges = serializeVariantsForDiff(rows) !== serializeVariantsForDiff(initialVariants)
  const canClearExisting = rows.length === 0 && initialVariants.length > 0 && groups.length === 0
  const saveDisabled = !hasChanges || (rows.length === 0 && !canClearExisting)

  return (
    <>
      <DialogHeader showCloseButton>
        <DialogTitle>Manage product variants</DialogTitle>
        <DialogDescription>
          Add option groups like Color and Size — combinations are created automatically. Remove any combination you don&apos;t sell.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className={styles.matrixBody}>
        {/* Step 1: Option Groups */}
        <section className={styles.matrixSection}>
          <div className={styles.matrixSectionHeader}>
            <div>
              <h3 className={styles.matrixSectionTitle}>1. Option groups (up to {MAX_OPTION_GROUPS})</h3>
              <p className={styles.matrixSectionSub}>e.g. Color (Black, White, Red) × Size (S, M, L)</p>
            </div>
            {groups.length < MAX_OPTION_GROUPS && (
              <Button type="button" variant="outline" size="sm" onClick={addGroup} className={styles.footerBtn}>
                <PlusIcon className={styles.icon14} /> Add option group
              </Button>
            )}
          </div>

          {groups.length === 0 && (
            <div className={styles.templateChipsRow}>
              <button
                type="button"
                className={styles.templateChipBtn}
                onClick={() =>
                  applyTemplate([
                    { name: "Color", values: ["Black", "White"] },
                    { name: "Size", values: ["S", "M", "L"] },
                  ])
                }
              >
                <SparklesIcon className={styles.icon12} /> Color + Size
              </button>
              <button
                type="button"
                className={styles.templateChipBtn}
                onClick={() => applyTemplate([{ name: "Size", values: ["S", "M", "L", "XL"] }])}
              >
                Size only (S–XL)
              </button>
              <button
                type="button"
                className={styles.templateChipBtn}
                onClick={() =>
                  applyTemplate([
                    { name: "Color", values: ["Black", "Blue"] },
                    { name: "Storage", values: ["128 GB", "256 GB"] },
                  ])
                }
              >
                Color + Storage
              </button>
              <button
                type="button"
                className={styles.templateChipBtn}
                onClick={() => applyTemplate([{ name: "Weight", values: ["250g", "500g", "1 kg"] }])}
              >
                Weight / Pack
              </button>
            </div>
          )}

          {groups.length > 0 && (
            <div className={styles.groupsList}>
              {groups.map((g) => (
                <div key={g.id} className={styles.groupCard}>
                  <div className={styles.groupTopRow}>
                    <input
                      type="text"
                      value={g.name}
                      maxLength={30}
                      placeholder="Option name (e.g. Color, Size)"
                      aria-label="Option group name"
                      onChange={(e) => updateGroupName(g.id, e.target.value)}
                      className={styles.groupNameInput}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${g.name || "option group"}`}
                      onClick={() => removeGroup(g.id)}
                      className={styles.removeIconBtn}
                    >
                      <Trash2Icon className={styles.icon14} />
                    </Button>
                  </div>
                  <div className={styles.valuesWrap}>
                    {g.values.map((val) => (
                      <span key={val} className={styles.valueChip}>
                        <span>{val}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${val}`}
                          onClick={() => removeGroupValue(g.id, val)}
                          className={styles.valueChipRemoveBtn}
                        >
                          <XIcon className={styles.icon12} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={g.draftInput}
                      placeholder={g.values.length === 0 ? "Type value & press Enter (e.g. Red, Blue)" : "Add value…"}
                      aria-label={`Add value to ${g.name || "option"}`}
                      onChange={(e) =>
                        setGroups((prev) => prev.map((x) => (x.id === g.id ? { ...x, draftInput: e.target.value } : x)))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault()
                          commitGroupValues(g.id, g.draftInput)
                        }
                      }}
                      onBlur={() => {
                        if (g.draftInput.trim()) commitGroupValues(g.id, g.draftInput)
                      }}
                      className={styles.valueAddInput}
                    />
                  </div>
                  <p className={styles.groupHint}>Press Enter or comma after each value.</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Generated Combinations + Bulk Edit */}
        {rows.length > 0 && (
          <section className={styles.matrixSection}>
            <div className={styles.matrixSectionHeader}>
              <div>
                <h3 className={styles.matrixSectionTitle}>2. Pricing &amp; stock ({rows.length} combinations)</h3>
                <p className={styles.matrixSectionSub}>Set one price for all, price by Size/Color, or edit individual combinations below.</p>
              </div>
            </div>

            {activeGroups.length >= 2 && (
              <div className={styles.ruleTabsBlock}>
                <div className={styles.ruleTabsRow} role="tablist" aria-label="Quick pricing mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={effectiveRuleGroup === "none"}
                    onClick={() => setPriceRuleGroup("none")}
                    className={effectiveRuleGroup === "none" ? styles.ruleTabActive : styles.ruleTabBtn}
                  >
                    Bulk / Same price
                  </button>
                  {activeGroups.map((g) => {
                    const gName = g.name.trim()
                    const isActive = effectiveRuleGroup === gName
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setPriceRuleGroup(gName)}
                        className={isActive ? styles.ruleTabActive : styles.ruleTabBtn}
                      >
                        Price by {gName}
                      </button>
                    )
                  })}
                </div>

                {effectiveRuleGroup !== "none" && (
                  <div className={styles.ruleGridCard}>
                    <p className={styles.ruleGridHint}>
                      Change price or stock for any <strong>{effectiveRuleGroup}</strong> — updates every combination with that {effectiveRuleGroup.toLowerCase()} automatically.
                    </p>
                    <ul className={styles.ruleGridList}>
                      {(activeGroups.find((g) => g.name.trim() === effectiveRuleGroup)?.values ?? []).map((val) => {
                        const sample = rows.find((r) => r.options?.[effectiveRuleGroup] === val)
                        const matchCount = rows.filter((r) => r.options?.[effectiveRuleGroup] === val).length
                        return (
                          <li key={val} className={styles.ruleGridRow}>
                            <span className={styles.ruleValCol}>
                              <span className={styles.ruleValBadge}>{val}</span>
                              <span className={styles.ruleValCount}>{matchCount} items</span>
                            </span>
                            <div className={styles.ruleInputsRow}>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={1}
                                placeholder="Price ₹"
                                aria-label={`Price for all ${val}`}
                                value={sample?.price ?? ""}
                                onChange={(e) => applyPriceForOptionValue(effectiveRuleGroup, val, "price", e.target.value)}
                                className={styles.ruleMiniInput}
                              />
                              <input
                                type="number"
                                inputMode="decimal"
                                min={1}
                                placeholder="MRP ₹"
                                aria-label={`MRP for all ${val}`}
                                value={sample?.compareAtPrice ?? ""}
                                onChange={(e) => applyPriceForOptionValue(effectiveRuleGroup, val, "compareAtPrice", e.target.value)}
                                className={styles.ruleMiniInput}
                              />
                              <input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                placeholder="Stock"
                                aria-label={`Stock for all ${val}`}
                                value={sample?.stock ?? ""}
                                onChange={(e) => applyPriceForOptionValue(effectiveRuleGroup, val, "stock", e.target.value)}
                                className={styles.ruleMiniInput}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {effectiveRuleGroup === "none" && (
              <div className={styles.bulkBar}>
                {activeGroups.length > 0 && (
                  <div className={styles.bulkScopeField}>
                    <label htmlFor="bulk-scope" className={styles.bulkLabel}>Apply to</label>
                    <select
                      id="bulk-scope"
                      value={bulkScope}
                      onChange={(e) => setBulkScope(e.target.value)}
                      className={styles.bulkSelect}
                    >
                      <option value="all">All combinations ({rows.length})</option>
                      {activeGroups.map((g) => (
                        <optgroup key={g.id} label={`By ${g.name.trim()}`}>
                          {g.values.map((v) => (
                            <option key={`${g.name.trim()}::${v}`} value={`${g.name.trim()}::${v}`}>
                              {g.name.trim()}: {v}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}
                <div className={styles.bulkField}>
                  <label htmlFor="bulk-price" className={styles.bulkLabel}>Price (₹)</label>
                  <input
                    id="bulk-price"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="799"
                    value={bulkPrice}
                    onChange={(e) => setBulkPrice(e.target.value)}
                    className={styles.bulkInput}
                  />
                </div>
                <div className={styles.bulkField}>
                  <label htmlFor="bulk-mrp" className={styles.bulkLabel}>MRP (₹)</label>
                  <input
                    id="bulk-mrp"
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="Optional"
                    value={bulkCompare}
                    onChange={(e) => setBulkCompare(e.target.value)}
                    className={styles.bulkInput}
                  />
                </div>
                <div className={styles.bulkField}>
                  <label htmlFor="bulk-stock" className={styles.bulkLabel}>Stock</label>
                  <input
                    id="bulk-stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="5"
                    value={bulkStock}
                    onChange={(e) => setBulkStock(e.target.value)}
                    className={styles.bulkInput}
                  />
                </div>
                <Button type="button" variant="secondary" size="sm" onClick={applyBulk} className={styles.bulkApplyBtn}>
                  Apply
                </Button>
              </div>
            )}

            <ul className={styles.combosList}>
              {rows.map((row, idx) => (
                <li key={row.id} className={styles.comboRowCard}>
                  <div className={styles.comboHeaderRow}>
                    <div className={styles.comboLabelBadges}>
                      {row.options && Object.keys(row.options).length > 0 ? (
                        Object.entries(row.options).map(([ok, ov]) => (
                          <span key={ok} className={styles.comboOptionBadge}>
                            {ok}: {ov}
                          </span>
                        ))
                      ) : (
                        <span className={styles.comboOptionBadge}>{row.label}</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${row.label}`}
                      onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                      className={styles.removeIconBtn}
                    >
                      <Trash2Icon className={styles.icon14} />
                    </Button>
                  </div>
                  <div className={styles.comboInputsGrid}>
                    <div className={styles.comboInputCell}>
                      <label htmlFor={`variant-price-${row.id}`} className={styles.comboCellLabel}>Price (₹) *</label>
                      <input
                        id={`variant-price-${row.id}`}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        aria-label={`${row.label} price in rupees`}
                        value={row.price}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, price: e.target.value } : x)))
                        }
                        className={styles.comboCellInput}
                      />
                    </div>
                    <div className={styles.comboInputCell}>
                      <label htmlFor={`variant-mrp-${row.id}`} className={styles.comboCellLabel}>MRP (₹)</label>
                      <input
                        id={`variant-mrp-${row.id}`}
                        type="number"
                        inputMode="decimal"
                        min={1}
                        placeholder="Optional"
                        aria-label={`${row.label} MRP in rupees`}
                        value={row.compareAtPrice ?? ""}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, compareAtPrice: e.target.value } : x)))
                        }
                        className={styles.comboCellInput}
                      />
                    </div>
                    <div className={styles.comboInputCell}>
                      <label htmlFor={`variant-stock-${row.id}`} className={styles.comboCellLabel}>Stock *</label>
                      <input
                        id={`variant-stock-${row.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`${row.label} stock quantity`}
                        value={row.stock}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, stock: e.target.value } : x)))
                        }
                        className={styles.comboCellInput}
                      />
                    </div>
                    <div className={styles.comboInputCell}>
                      <label htmlFor={`variant-sku-${row.id}`} className={styles.comboCellLabel}>SKU</label>
                      <input
                        id={`variant-sku-${row.id}`}
                        type="text"
                        maxLength={40}
                        placeholder="Optional"
                        aria-label={`${row.label} SKU`}
                        value={row.sku ?? ""}
                        onChange={(e) =>
                          setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))
                        }
                        className={styles.comboCellInput}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {errorMsg && (
          <p role="alert" className={styles.matrixErrorBanner}>
            {errorMsg}
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onClose} className={styles.footerBtn}>
          Cancel
        </Button>
        <Button type="button" size="lg" disabled={saveDisabled} onClick={handleSave} className={styles.footerBtn}>
          {canClearExisting
            ? "Clear variants"
            : rows.length === 0
              ? "Add variants to save"
              : !hasChanges
                ? "No changes"
                : `Save ${rows.length} variant${rows.length === 1 ? "" : "s"}`}
        </Button>
      </DialogFooter>
    </>
  )
}

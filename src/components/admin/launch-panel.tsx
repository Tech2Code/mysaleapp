"use client"

import { CheckCircle2Icon, ChevronRightIcon, CircleDashedIcon, Loader2Icon, RocketIcon, Trash2Icon, TriangleAlertIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useLayoutEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { resetStoreData } from "@/features/settings/launch-actions"
import { RESET_CONFIRM_WORD, RESET_SCOPE_INFO, RESET_SCOPES, type LaunchCounts, type ResetScope } from "@/features/settings/launch"
import type { ChecklistItem } from "@/features/settings/launch-queries"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-views.module.css"

const COUNT_LABEL: Record<ResetScope, (c: LaunchCounts) => string> = {
  orders: (c) => `${c.orders} order${c.orders === 1 ? "" : "s"}`,
  customers: (c) => `${c.addresses} address${c.addresses === 1 ? "" : "es"}, ${c.wishlists} wishlist item${c.wishlists === 1 ? "" : "s"}`,
  catalog: (c) => `${c.products} product${c.products === 1 ? "" : "s"}, ${c.categories} categor${c.categories === 1 ? "y" : "ies"}`,
}

type LaunchSectionId = "checklist" | "reset"

const ALL_LAUNCH_SECTIONS: ReadonlySet<string> = new Set(["checklist", "reset"])

function LaunchSectionQuerySync({ onSelect }: { onSelect: (id: LaunchSectionId) => void }) {
  const searchParams = useSearchParams()
  const sectionParam = searchParams.get("section")

  useEffect(() => {
    if (!sectionParam || !ALL_LAUNCH_SECTIONS.has(sectionParam)) return
    onSelect(sectionParam as LaunchSectionId)
    if (typeof window !== "undefined") {
      const next = new URLSearchParams(window.location.search)
      next.delete("section")
      const qs = next.toString()
      window.history.replaceState(window.history.state, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    }
  }, [sectionParam, onSelect])

  return null
}

/** Launch checklist + the "clear test data" tool in the unified Settings Hub layout (desktop 2-col + mobile full-screen Dialog). */
export function LaunchPanel({ counts, checklist }: { counts: LaunchCounts; checklist: ChecklistItem[] }) {
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 959.98px)")
  const [activeSection, setActiveSection] = useState<LaunchSectionId>("checklist")
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [scopes, setScopes] = useState<ResetScope[]>(["orders", "customers"])
  const [confirm, setConfirm] = useState("")
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  useLayoutEffect(() => {
    return () => {
      setConfirm("")
      setConfirmError(null)
      setMobileDetailOpen(false)
    }
  }, [])

  const selectSection = useCallback((id: LaunchSectionId) => {
    if (id !== "reset") {
      setConfirm("")
      setConfirmError(null)
    }
    setActiveSection(id)
    setMobileDetailOpen(true)
  }, [])

  const doneCount = checklist.filter((c) => c.done).length
  const ready = checklist.every((c) => c.done)
  const placeholders = checklist.filter((c) => c.settings && !c.done)
  const canRun = scopes.length > 0 && confirm.trim() === RESET_CONFIRM_WORD && !pending
  const totalRecords = counts.orders + counts.products + counts.categories + counts.addresses + counts.wishlists

  const toggle = (s: ResetScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const run = () =>
    startTransition(async () => {
      setConfirmError(null)
      const res = await resetStoreData({ scopes, confirm: confirm.trim() })
      if (!res.ok) {
        if (res.fieldErrors?.confirm?.[0]) setConfirmError(res.fieldErrors.confirm[0])
        toast.error(res.error)
        return
      }
      const d = res.data
      const msg = `Cleared: ${[d.orders && `${d.orders} orders`, d.products && `${d.products} products`, d.categories && `${d.categories} categories`, d.addresses && `${d.addresses} addresses`, d.wishlists && `${d.wishlists} wishlist items`, d.images && `${d.images} photos`]
          .filter(Boolean)
          .join(", ") || "nothing to clear"}`
      if (d.imagesFailed > 0 || d.imagesUnlisted) toast.warning(msg)
      else later(() => toast.success(msg))
      if (d.imagesFailed > 0 || d.imagesUnlisted) {
        toast.error(
          `The database data was cleared, but ${d.imagesFailed > 0 ? `${d.imagesFailed} product photo${d.imagesFailed === 1 ? "" : "s"} could not be removed from storage` : "the photo storage could not be fully listed"}${d.imagesFailed > 0 && d.imagesUnlisted ? ", and some folders could not be read" : ""}. Delete the leftovers in Supabase Storage (product-images).`
        )
      }
      setConfirm("")
      router.refresh()
    })

  const navItems: {
    id: LaunchSectionId
    title: string
    meta: string
    icon: LucideIcon
    liveDot?: boolean
    countText?: string
  }[] = [
    {
      id: "checklist",
      title: "Launch checklist",
      meta: ready ? "All checks passed · Ready to go live" : `${doneCount} of ${checklist.length} completed`,
      icon: RocketIcon,
      liveDot: ready,
      countText: !ready ? `${doneCount}/${checklist.length}` : undefined,
    },
    {
      id: "reset",
      title: "Clear test data",
      meta: totalRecords > 0 ? `${counts.orders} orders · ${counts.products} products` : "Database is clean",
      icon: Trash2Icon,
    },
  ]

  const activeNavItem = navItems.find((item) => item.id === activeSection) ?? navItems[0]

  const renderSectionContent = () => {
    if (activeSection === "checklist") {
      return (
        <section className={cn("adminCard", styles.launchCard)}>
          <div>
            <h2 className={styles.launchTitle}>Ready to launch?</h2>
            <p className={styles.launchSub}>
              {ready ? "Everything is in place. You can go live." : "Finish these before sharing the store link."}
            </p>
          </div>
          {placeholders.length > 0 && (
            <div role="alert" className={styles.placeholderAlert}>
              <p className={styles.alertHeading}>
                <TriangleAlertIcon className={styles.iconMd} aria-hidden /> Placeholder settings found
              </p>
              <p className={styles.alertBody}>
                {placeholders.map((p) => p.label).join(", ")} still hold starter or empty values that customers would see.{" "}
                <Link href="/admin/settings" className={styles.alertLink}>Open Settings</Link>
              </p>
            </div>
          )}
          <ul className={styles.checklist}>
            {checklist.map((c) => (
              <li key={c.label} className={styles.checklistItem}>
                <Link href={c.href} className={styles.checklistLink}>
                  {c.done ? (
                    <CheckCircle2Icon className={styles.iconDone} aria-hidden />
                  ) : (
                    <CircleDashedIcon className={styles.iconTodo} aria-hidden />
                  )}
                  <span className={styles.checklistText}>
                    <span className={styles.checklistLabel}>{c.label}</span>
                    {!c.done && <span className={styles.checklistHint}>{c.hint}</span>}
                  </span>
                  <span className={styles.srOnly}>{c.done ? "Done" : "To do"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )
    }

    return (
      <section className={cn("adminCard", styles.launchCard, styles.launchCardDanger)}>
        <div>
          <h2 className={styles.launchDangerTitle}>
            <TriangleAlertIcon className={styles.iconLg} aria-hidden /> Clear test data
          </h2>
          <p className={styles.launchSub}>
            Testing is done? Remove the practice data and start fresh. Your shop settings and admin login are never touched. This can&apos;t be undone.
          </p>
        </div>

        <fieldset className={styles.scopeFieldset}>
          <legend className={styles.srOnly}>What to clear</legend>
          {RESET_SCOPES.map((s) => (
            <label
              key={s}
              className={cn(styles.scopeLabel, scopes.includes(s) && styles.scopeLabelSelected)}
            >
              <Checkbox
                tone="destructive"
                checked={scopes.includes(s)}
                onChange={() => toggle(s)}
                className={styles.scopeCheckbox}
              />
              <span className={styles.scopeContent}>
                <span className={styles.scopeTop}>
                  <span className={styles.scopeName}>{RESET_SCOPE_INFO[s].label}</span>
                  <span className={styles.scopeCount}>Now: {COUNT_LABEL[s](counts)}</span>
                </span>
                <span className={styles.scopeDesc}>{RESET_SCOPE_INFO[s].description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <TextField
          label={`Type ${RESET_CONFIRM_WORD} to confirm`}
          fieldSize="md"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            if (confirmError) setConfirmError(null)
          }}
          autoComplete="off"
          maxLength={10}
          placeholder={RESET_CONFIRM_WORD}
          error={confirmError ?? undefined}
        />
        <Button type="button" variant="destructive" disabled={!canRun} onClick={run} className={styles.pillBtn}>
          {pending && <Loader2Icon className={styles.spinIcon} aria-hidden="true" />} Clear selected data
        </Button>
      </section>
    )
  }

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = navItems.findIndex((i) => i.id === activeSection)
    if (idx < 0) return
    let nextIdx: number | null = null
    if (event.key === "ArrowDown") nextIdx = (idx + 1) % navItems.length
    else if (event.key === "ArrowUp") nextIdx = (idx - 1 + navItems.length) % navItems.length
    else if (event.key === "Home") nextIdx = 0
    else if (event.key === "End") nextIdx = navItems.length - 1
    if (nextIdx === null) return
    event.preventDefault()
    const nextId = navItems[nextIdx].id
    selectSection(nextId)
    document.getElementById(`launch-tab-${nextId}`)?.focus()
  }

  return (
    <div className={styles.settingsWorkspace}>
      <Suspense fallback={null}>
        <LaunchSectionQuerySync onSelect={selectSection} />
      </Suspense>

      <nav aria-label="Data and launch sections" className={styles.settingsNavCol}>
        <div className={styles.settingsNavGroup}>
          <p className={styles.settingsGroupLabel}>Store readiness</p>
          <div className={styles.settingsNavList} role="tablist" aria-orientation="vertical" onKeyDown={handleNavKeyDown}>
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  id={`launch-tab-${item.id}`}
                  type="button"
                  role="tab"
                  tabIndex={active ? 0 : -1}
                  aria-selected={active}
                  aria-controls={`launch-panel-${item.id}`}
                  onClick={() => selectSection(item.id)}
                  className={cn(styles.settingsNavBtn, active && styles.settingsNavBtnActive)}
                >
                  <span className={styles.settingsNavIcon} aria-hidden="true">
                    <Icon className={styles.iconMd} />
                  </span>
                  <span className={styles.settingsNavText}>
                    <span className={styles.settingsNavTitle}>{item.title}</span>
                    <span className={styles.settingsNavMeta}>{item.meta}</span>
                  </span>
                  <span className={styles.settingsNavEnd}>
                    {item.liveDot && (
                      <>
                        <span className={styles.settingsNavLiveDot} aria-hidden="true" title="Ready" />
                        <span className={styles.srOnly}>Ready</span>
                      </>
                    )}
                    {item.countText && <span className={styles.settingsNavCountPill}>{item.countText}</span>}
                    <ChevronRightIcon className={styles.settingsNavChevron} aria-hidden="true" />
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {!isMobile && (
        <div
          id={`launch-panel-${activeSection}`}
          role="tabpanel"
          aria-labelledby={`launch-tab-${activeSection}`}
          className={styles.settingsPaneCol}
        >
          <div className={styles.settingsSectionStack}>{renderSectionContent()}</div>
        </div>
      )}

      {isMobile && (
        <Dialog
          open={mobileDetailOpen}
          onOpenChange={(next) => {
            if (!pending) {
              if (!next) {
                setConfirm("")
                setConfirmError(null)
              }
              setMobileDetailOpen(next)
            }
          }}
        >
          <DialogContent mobileFullScreen className={styles.settingsMobileDialog}>
            <DialogHeader>
              <DialogTitle>{activeNavItem.title}</DialogTitle>
              <DialogDescription className={styles.srOnly}>
                {activeNavItem.title}
              </DialogDescription>
            </DialogHeader>
            <DialogBody resetScrollKey={activeSection} className={styles.settingsMobileDialogBody}>
              {renderSectionContent()}
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

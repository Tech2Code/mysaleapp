"use client"

import { CheckCircle2Icon, CircleDashedIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { resetStoreData } from "@/features/settings/launch-actions"
import { RESET_CONFIRM_WORD, RESET_SCOPE_INFO, RESET_SCOPES, type LaunchCounts, type ResetScope } from "@/features/settings/launch"
import type { ChecklistItem } from "@/features/settings/launch-queries"
import { cn } from "@/lib/utils"
import { useBlockWhile } from "@/components/shared/busy-overlay"
import { useToastAfter } from "@/hooks/use-toast-after"
import styles from "./admin-views.module.css"

const COUNT_LABEL: Record<ResetScope, (c: LaunchCounts) => string> = {
  orders: (c) => `${c.orders} order${c.orders === 1 ? "" : "s"}`,
  customers: (c) => `${c.addresses} address${c.addresses === 1 ? "" : "es"}, ${c.wishlists} wishlist item${c.wishlists === 1 ? "" : "s"}`,
  catalog: (c) => `${c.products} product${c.products === 1 ? "" : "s"}, ${c.categories} categor${c.categories === 1 ? "y" : "ies"}`,
}

/** Launch checklist + the "clear test data" tool. */
export function LaunchPanel({ counts, checklist }: { counts: LaunchCounts; checklist: ChecklistItem[] }) {
  const router = useRouter()
  const [scopes, setScopes] = useState<ResetScope[]>(["orders", "customers"])
  const [confirm, setConfirm] = useState("")
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const ready = checklist.every((c) => c.done)
  const placeholders = checklist.filter((c) => c.settings && !c.done)
  const canRun = scopes.length > 0 && confirm.trim() === RESET_CONFIRM_WORD && !pending

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

  return (
    <div className={styles.launchGrid}>
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
          {pending && <Loader2Icon className={styles.spinIcon} />} Clear selected data
        </Button>
      </section>
    </div>
  )
}

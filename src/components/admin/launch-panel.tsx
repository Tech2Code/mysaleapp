"use client"

import { CheckCircle2Icon, CircleDashedIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { Button } from "@/components/ui/button"
import { resetStoreData } from "@/features/settings/launch-actions"
import { RESET_CONFIRM_WORD, RESET_SCOPE_INFO, RESET_SCOPES, type LaunchCounts, type ResetScope } from "@/features/settings/launch"
import type { ChecklistItem } from "@/features/settings/launch-queries"
import { cn } from "@/lib/utils"

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
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const ready = checklist.every((c) => c.done)
  const canRun = scopes.length > 0 && confirm.trim() === RESET_CONFIRM_WORD && !pending

  const toggle = (s: ResetScope) => setScopes((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))

  const run = () =>
    startTransition(async () => {
      setError(null)
      const res = await resetStoreData({ scopes, confirm: confirm.trim() })
      if (!res.ok) {
        setError(res.error)
        return
      }
      const d = res.data
      toast.success(
        `Cleared: ${[d.orders && `${d.orders} orders`, d.products && `${d.products} products`, d.categories && `${d.categories} categories`, d.addresses && `${d.addresses} addresses`, d.wishlists && `${d.wishlists} wishlist items`, d.images && `${d.images} photos`]
          .filter(Boolean)
          .join(", ") || "nothing to clear"}`
      )
      setConfirm("")
      router.refresh()
    })

  return (
    <div data-ui="admin/LaunchPanel" className="grid gap-6 xl:grid-cols-2 xl:items-start">
      <section data-ui="admin/LaunchPanel/section" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div data-ui="admin/LaunchPanel/div">
          <h2 data-ui="admin/LaunchPanel/h2-ready-to-launch" className="font-sans text-lg font-semibold">Ready to launch?</h2>
          <p data-ui="admin/LaunchPanel/p" className="mt-0.5 text-sm text-muted-foreground">
            {ready ? "Everything is in place. You can go live." : "Finish these before sharing the store link."}
          </p>
        </div>
        <ul data-ui="admin/LaunchPanel/ul" className="divide-y rounded-xl border">
          {checklist.map((c) => (
            <li data-ui="admin/LaunchPanel/li" key={c.label}>
              <Link data-ui="admin/LaunchPanel/Link-flex" href={c.href} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/50">
                {c.done ? (
                  <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
                ) : (
                  <CircleDashedIcon className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                )}
                <span data-ui="admin/LaunchPanel/span" className="min-w-0 flex-1">
                  <span data-ui="admin/LaunchPanel/span-2" className="block text-sm font-medium">{c.label}</span>
                  {!c.done && <span data-ui="admin/LaunchPanel/span-3" className="block text-xs text-muted-foreground">{c.hint}</span>}
                </span>
                <span data-ui="admin/LaunchPanel/span-4" className="sr-only">{c.done ? "Done" : "To do"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section data-ui="admin/LaunchPanel/section-2" className="space-y-5 rounded-2xl border border-destructive/30 bg-card p-5 sm:p-6">
        <div data-ui="admin/LaunchPanel/div-2">
          <h2 data-ui="admin/LaunchPanel/h2-clear-test-data" className="flex items-center gap-2 font-sans text-lg font-semibold text-destructive">
            <TriangleAlertIcon className="size-5" aria-hidden /> Clear test data
          </h2>
          <p data-ui="admin/LaunchPanel/p-2" className="mt-0.5 text-sm text-muted-foreground">
            Testing is done? Remove the practice data and start fresh. Your shop settings and admin login are never touched. This can&apos;t be undone.
          </p>
        </div>

        <fieldset data-ui="admin/LaunchPanel/fieldset" className="space-y-2">
          <legend data-ui="admin/LaunchPanel/legend-what-to-clear" className="sr-only">What to clear</legend>
          {RESET_SCOPES.map((s) => (
            <label data-ui="admin/LaunchPanel/label"
              key={s}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                scopes.includes(s) ? "border-destructive/50 bg-destructive/5" : "hover:bg-muted/50"
              )}
            >
              <input data-ui="admin/LaunchPanel/input-checkbox"
                type="checkbox"
                checked={scopes.includes(s)}
                onChange={() => toggle(s)}
                className="mt-1 size-4 shrink-0 accent-(--destructive)"
              />
              <span data-ui="admin/LaunchPanel/span-5" className="min-w-0 flex-1">
                <span data-ui="admin/LaunchPanel/span-flex" className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span data-ui="admin/LaunchPanel/span-6" className="text-sm font-semibold">{RESET_SCOPE_INFO[s].label}</span>
                  <span data-ui="admin/LaunchPanel/span-7" className="text-xs text-muted-foreground">Now: {COUNT_LABEL[s](counts)}</span>
                </span>
                <span data-ui="admin/LaunchPanel/span-8" className="block text-xs text-muted-foreground">{RESET_SCOPE_INFO[s].description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <TextField
          label={`Type ${RESET_CONFIRM_WORD} to confirm`}
          fieldSize="md"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          maxLength={10}
          placeholder={RESET_CONFIRM_WORD}
        />
        {error && (
          <p data-ui="admin/LaunchPanel/p-3" role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button data-ui="admin/LaunchPanel/Button-clear-selected-data" type="button" variant="destructive" disabled={!canRun} onClick={run} className="rounded-full">
          {pending && <Loader2Icon className="animate-spin" />} Clear selected data
        </Button>
      </section>
    </div>
  )
}

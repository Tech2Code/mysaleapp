import { CheckIcon, XIcon } from "lucide-react"
import { returnStage, returnTimeline, stageDetail, type ReturnStageInput } from "@/features/orders/returns"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ReturnStageBadge } from "./return-stage-badge"

/**
 * The return's own timeline (requested → approved → received → refunded), shown under the order progress
 * once a return exists. Same component for admin, signed-in customers and guests: no amounts, no addresses.
 */
export function ReturnTimeline({ input, audience, title = "Return progress" }: { input: ReturnStageInput; audience: "admin" | "customer"; title?: string }) {
  const stage = returnStage(input)
  const entries = returnTimeline(input)
  if (!stage || entries.length === 0) return null

  return (
    <section data-ui="shared/ReturnTimeline" aria-label={title} className="rounded-2xl border bg-card p-4 sm:p-5">
      <div data-ui="shared/ReturnTimeline/div-flex" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 data-ui="shared/ReturnTimeline/h3" className="font-sans text-base font-semibold">{title}</h3>
        <ReturnStageBadge stage={stage} audience={audience} alwaysShow />
      </div>
      <p data-ui="shared/ReturnTimeline/p" className="-mt-2 mb-4 text-sm text-muted-foreground">{stageDetail(stage, audience)}</p>
      <ol data-ui="shared/ReturnTimeline/ol">
        {entries.map((e, i) => {
          const last = i === entries.length - 1
          const reached = e.state === "done" || e.state === "current"
          return (
            <li data-ui="shared/ReturnTimeline/li-flex" key={e.key} className="flex gap-3">
              <div data-ui="shared/ReturnTimeline/div-flex-2" className="flex shrink-0 flex-col items-center">
                <span
                  data-ui="shared/ReturnTimeline/span"
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border-2",
                    e.state === "upcoming" && "border-border bg-background text-muted-foreground",
                    reached && "border-primary bg-primary text-primary-foreground",
                    e.state === "done" && e.key !== "requested" && "border-success-solid bg-success-solid text-white",
                    e.state === "stopped" && "border-destructive-solid bg-destructive-solid text-white"
                  )}
                >
                  {e.state === "stopped" ? (
                    <XIcon className="size-3.5" aria-hidden />
                  ) : reached ? (
                    <CheckIcon className="size-3.5" aria-hidden />
                  ) : (
                    <span data-ui="shared/ReturnTimeline/span-2" className="text-[11px] font-semibold">{i + 1}</span>
                  )}
                </span>
                {!last && <span data-ui="shared/ReturnTimeline/span-3" aria-hidden className={cn("my-1 min-h-3 w-0.5 flex-1 rounded-full", reached ? "bg-primary/60" : "bg-border")} />}
              </div>
              <div data-ui="shared/ReturnTimeline/div" className={cn("min-w-0 flex-1 pt-0.5 leading-snug", !last && "pb-4")}>
                <p data-ui="shared/ReturnTimeline/p-2" className={cn("text-sm font-semibold", e.state === "upcoming" && "text-muted-foreground", e.state === "stopped" && "text-destructive")}>
                  {audience === "admin" ? e.label : e.customerLabel}
                  {e.state === "current" && <span data-ui="shared/ReturnTimeline/span-4" className="sr-only"> (current step)</span>}
                </p>
                {e.at && <p data-ui="shared/ReturnTimeline/p-3" className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>}
                {e.note && <p data-ui="shared/ReturnTimeline/p-4" className="mt-0.5 text-sm text-muted-foreground">{e.note}</p>}
                {audience === "admin" && e.adminDetail && <p data-ui="shared/ReturnTimeline/p-5" className="mt-0.5 text-sm text-muted-foreground">{e.adminDetail}</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

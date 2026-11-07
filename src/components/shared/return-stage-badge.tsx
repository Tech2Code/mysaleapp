import { BanIcon, CheckCircle2Icon, HourglassIcon, PackageOpenIcon, Undo2Icon, XCircleIcon, type LucideIcon } from "lucide-react"
import { stageLabel, type ReturnStage, type ReturnStageKey } from "@/features/orders/returns"
import { cn } from "@/lib/utils"
import { TONES } from "./status-badge"

const ICONS: Record<ReturnStageKey, LucideIcon> = {
  requested: HourglassIcon,
  approved: CheckCircle2Icon,
  rejected: XCircleIcon,
  withdrawn: BanIcon,
  received: PackageOpenIcon,
  partly_refunded: Undo2Icon,
  refunded: Undo2Icon,
}

/**
 * The return stage next to the order status ("Delivered" + "Return approved"). Icon + text, so colour is
 * never the only signal. Renders nothing when there is no stage, or (in lists) for a withdrawn request.
 */
export function ReturnStageBadge({
  stage,
  audience,
  className,
  alwaysShow = false,
}: {
  stage: ReturnStage | null
  audience: "admin" | "customer"
  className?: string
  /** Detail pages show even a withdrawn request; lists leave it out. */
  alwaysShow?: boolean
}) {
  if (!stage || (!stage.badge && !alwaysShow)) return null
  const Icon = ICONS[stage.key]
  return (
    <span
      data-ui="shared/ReturnStageBadge"
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", TONES[stage.tone], className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {stageLabel(stage, audience)}
    </span>
  )
}

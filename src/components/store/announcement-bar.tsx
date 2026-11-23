import { MegaphoneIcon } from "lucide-react"

/** One-line banner at the top of every store page. Set it in Admin → Settings; leave empty to hide it. */
export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div data-ui="store/AnnouncementBar" role="status" className="border-b border-primary/20 bg-primary px-4 py-1.5 text-center text-xs font-medium tracking-wide text-primary-foreground sm:text-[0.8125rem]">
      <span data-ui="store/AnnouncementBar/span-inline-flex" className="inline-flex items-center gap-1.5">
        <MegaphoneIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
        {text}
      </span>
    </div>
  )
}

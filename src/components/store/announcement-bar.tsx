import { MegaphoneIcon } from "lucide-react"

/** One-line banner at the top of every store page. Set it in Admin → Settings; leave empty to hide it. */
export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div data-ui="store/AnnouncementBar" role="status" className="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
      <span data-ui="store/AnnouncementBar/span-inline-flex" className="inline-flex items-center gap-2">
        <MegaphoneIcon className="size-4 shrink-0" aria-hidden />
        {text}
      </span>
    </div>
  )
}

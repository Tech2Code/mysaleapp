import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { FadeIn } from "@/components/shared/motion"

export function SectionHeading({
  eyebrow,
  title,
  href,
  linkLabel = "View all",
  id,
}: {
  eyebrow?: string
  title: string
  href?: string
  linkLabel?: string
  id?: string
}) {
  return (
    <FadeIn className="mb-8 flex items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-sm font-semibold tracking-widest text-primary uppercase">{eyebrow}</p>}
        <h2 id={id} className="mt-2 text-3xl font-semibold sm:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-primary sm:inline-flex"
        >
          {linkLabel}
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </FadeIn>
  )
}

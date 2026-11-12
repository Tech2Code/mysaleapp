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
    <FadeIn className="mb-4 flex items-end justify-between gap-4 sm:mb-8">
      <div data-ui="store/SectionHeading/div">
        {eyebrow && <p data-ui="store/SectionHeading/p" className="text-xs font-semibold tracking-widest text-primary uppercase sm:text-sm">{eyebrow}</p>}
        <h2 data-ui="store/SectionHeading/h2" id={id} className="mt-1 text-2xl font-semibold sm:mt-2 sm:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link data-ui="store/SectionHeading/Link-hidden"
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

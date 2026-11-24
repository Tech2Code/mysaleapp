import { ArrowRightIcon } from "lucide-react"
import Link from "next/link"
import { FadeIn } from "@/components/shared/motion"
import styles from "./section-heading.module.css"

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
    <FadeIn className={styles.headingRow}>
      <div className={styles.titleGroup}>
        {eyebrow && <p className={styles.eyebrowText}>{eyebrow}</p>}
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className={styles.viewAllLink}
        >
          {linkLabel}
          <ArrowRightIcon className={styles.linkArrow} aria-hidden />
        </Link>
      )}
    </FadeIn>
  )
}

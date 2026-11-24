import { ArrowRightIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"
import styles from "@/components/admin/admin-core.module.css"
import { cn } from "@/lib/utils"

const TONES = {
  sky: styles.tileToneSky,
  amber: styles.tileToneAmber,
  violet: styles.tileToneViolet,
  rose: styles.tileToneRose,
} as const

export function AttentionTile({
  href,
  icon: Icon,
  tone,
  count,
  label,
  hint,
  pulse,
}: {
  href: string
  icon: LucideIcon
  tone: keyof typeof TONES
  count: number
  label: string
  hint: string
  pulse?: boolean
}) {
  const active = count > 0
  return (
    <Link

      href={href}
      className={cn(
        "adminCardInteractive",
        styles.attentionTile,
        !active && styles.attentionTileIdle
      )}
    >
      <span className={cn(styles.tileIconBox, TONES[tone])}>
        {pulse && active && (
          <span aria-hidden className={styles.tilePulseDot} />
        )}
        <Icon className={styles.tileSvg} aria-hidden />
      </span>
      <div className={styles.tileContentCol}>
        <div className={styles.tileCountRow}>
          <p className={styles.tileCountNum}>{count}</p>
          <ArrowRightIcon className={styles.tileArrowIcon} aria-hidden />
        </div>
        <p className={styles.tileLabel}>{label}</p>
        <p className={styles.tileHint}>{active ? hint : "All clear"}</p>
      </div>
    </Link>
  )
}

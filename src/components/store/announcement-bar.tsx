import { MegaphoneIcon } from "lucide-react"
import styles from "./announcement-bar.module.css"

/** One-line banner at the top of every store page. Set it in Admin → Settings; leave empty to hide it. */
export function AnnouncementBar({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="status" className={styles.announcementBanner}>
      <span className={styles.bannerContent}>
        <MegaphoneIcon className={styles.bannerIcon} aria-hidden />
        {text}
      </span>
    </div>
  )
}

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import styles from "@/app/(store)/store-layout.module.css"

export default function NotFound() {
  return (
    <main className={cn(styles.fullCenterHeroMain, "bg-hero")}>
      <div>
        <p className={cn(styles.code404Number, "text-gradient")}>404</p>
        <h1 className={styles.statusPageTitle}>This page wandered off</h1>
        <p className={styles.statusPageLead}>The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
        <div className={styles.notFoundBtnsRow}>
          <Link href="/" className={cn(buttonVariants({ size: "lg" }), styles.pillBtnPx24)}>
            Go home
          </Link>
          <Link href="/products" className={cn(buttonVariants({ size: "lg", variant: "outline" }), styles.pillBtnPx24)}>
            Shop all
          </Link>
        </div>
      </div>
    </main>
  )
}

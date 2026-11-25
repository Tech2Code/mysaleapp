"use client"

import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { useStoreSettings } from "./store-settings-provider"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { cn } from "@/lib/utils"
import { WhatsAppIcon } from "./brand-icons"
import styles from "./whatsapp-fab.module.css"

function WhatsAppFabInner({ pathname }: { pathname: string | null }) {
  const shop = useStoreSettings()
  if (pathname === "/contact") return null
  const hideOnMobile = pathname !== null && (/^\/products\/[^/]+$/.test(pathname) || pathname === "/checkout")

  return (
    <m.a
      href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I have a question.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={cn(styles.fabLink, hideOnMobile && styles.fabHiddenMobile)}
    >
      <span className={styles.fabPulse} aria-hidden />
      <WhatsAppIcon className={styles.fabIcon} />
    </m.a>
  )
}

function WhatsAppFabWithPath() {
  return <WhatsAppFabInner pathname={usePathname()} />
}

export function WhatsAppFab() {
  return (
    <Suspense fallback={<WhatsAppFabInner pathname={null} />}>
      <WhatsAppFabWithPath />
    </Suspense>
  )
}

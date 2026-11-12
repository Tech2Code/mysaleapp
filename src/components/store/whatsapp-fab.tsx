"use client"

import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { useStoreSettings } from "./store-settings-provider"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { WhatsAppIcon } from "./brand-icons"

function WhatsAppFabInner({ pathname }: { pathname: string | null }) {
  const shop = useStoreSettings()
  const hideOnMobile = pathname !== null && (/^\/products\/[^/]+$/.test(pathname) || pathname === "/checkout")

  return (
    <m.a data-ui="store/WhatsAppFabInner"
      href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I have a question.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className={`fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 grid size-12 place-items-center rounded-full bg-whatsapp-solid text-white shadow-xl shadow-whatsapp/30 sm:right-6 sm:bottom-6 sm:size-14 ${hideOnMobile ? "max-sm:hidden" : ""}`}
    >
      <span data-ui="store/WhatsAppFabInner/span-absolute" className="absolute inset-0 animate-fab-ping rounded-full bg-whatsapp motion-reduce:animate-none" aria-hidden />
      <WhatsAppIcon className="relative size-6 sm:size-7" />
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

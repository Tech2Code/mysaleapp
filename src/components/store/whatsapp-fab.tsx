"use client"

import * as m from "motion/react-m"
import { useStoreSettings } from "./store-settings-provider"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { WhatsAppIcon } from "./brand-icons"

export function WhatsAppFab() {
  const shop = useStoreSettings()
  return (
    <m.a data-ui="store/WhatsAppFab"
      href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I have a question.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-whatsapp-solid text-white shadow-xl shadow-whatsapp/30 sm:right-6 sm:bottom-6"
    >
      <span data-ui="store/WhatsAppFab/span-absolute" className="absolute inset-0 animate-fab-ping rounded-full bg-whatsapp motion-reduce:animate-none" aria-hidden />
      <WhatsAppIcon className="relative size-7" />
    </m.a>
  )
}

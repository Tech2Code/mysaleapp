"use client"

import { motion } from "motion/react"
import { siteConfig } from "@/config/site"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { WhatsAppIcon } from "./brand-icons"

export function WhatsAppFab() {
  return (
    <motion.a
      href={shopWhatsappLink(`Hi ${siteConfig.name}! I have a question.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-whatsapp text-white shadow-xl shadow-whatsapp/30 sm:right-6 sm:bottom-6"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-whatsapp opacity-20" aria-hidden />
      <WhatsAppIcon className="relative size-7" />
    </motion.a>
  )
}

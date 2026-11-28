"use client"

import {
  ArrowRightIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TruckIcon,
} from "lucide-react"
import Link from "next/link"
import { useState, type ComponentType, type SVGProps } from "react"
import { SearchField } from "@/components/form"
import { JsonLd } from "@/components/shared/json-ld"
import { PillTabs } from "@/components/shared/pill-tabs"
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { PageHeader } from "@/components/store/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import faqData from "@/data/faqs.json"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { gstActive } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import styles from "./faq-view.module.css"

export type FaqCategoryKey = string

export type FaqCategoryConfig = {
  key: FaqCategoryKey
  label: string
  icon?: string
}

type RawFaqEntry = {
  id: string
  category: string
  defaultOpen?: boolean
  question: string
  answer: string
  link?: {
    href: string
    label: string
  }
}

export type FaqItem = {
  id: string
  category: string
  categoryLabel: string
  defaultOpen?: boolean
  question: string
  answer: string
  linkHref?: string
  linkLabel?: string
}

const FAQ_ICON_MAP: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "help-circle": HelpCircleIcon,
  "shield-check": ShieldCheckIcon,
  truck: TruckIcon,
  "rotate-ccw": RotateCcwIcon,
  sparkles: SparklesIcon,
}

const FAQ_CATEGORIES: (FaqCategoryConfig & { Icon: ComponentType<SVGProps<SVGSVGElement>> })[] = (
  faqData.categories as FaqCategoryConfig[]
).map((cat) => ({
  ...cat,
  Icon: (cat.icon && FAQ_ICON_MAP[cat.icon]) || HelpCircleIcon,
}))

const CATEGORY_LABEL_BY_KEY = new Map(FAQ_CATEGORIES.map((c) => [c.key, c.label]))

function interpolateFaqText(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? "")
}

export function buildStoreFaqs(shop: StoreSettings): FaqItem[] {
  const shippingSummary =
    shop.deliveryFee <= 0
      ? "Standard delivery is complimentary across India on every order."
      : shop.freeDeliveryAbove > 0
        ? `Standard delivery is ${formatPrice(shop.deliveryFee)}, and completely free on orders of ${formatPrice(shop.freeDeliveryAbove)} or above.`
        : `Standard doorstep delivery across India is a flat ${formatPrice(shop.deliveryFee)}.`

  const expiryText =
    shop.unpaidOrderExpiryHours > 0
      ? `When you place an order, payment is verified against the UTR you submit at checkout. If a payment needs correction, you have ${shop.unpaidOrderExpiryHours} ${shop.unpaidOrderExpiryHours === 1 ? "hour" : "hours"} to submit an updated UTR before unpaid orders expire automatically.`
      : "Your order is confirmed as soon as we verify the UPI reference number you submit at checkout."

  const returnSummary =
    shop.returnWindowDays > 0
      ? `We accept return and replacement requests within ${shop.returnWindowDays} ${shop.returnWindowDays === 1 ? "day" : "days"} of delivery for damaged, defective, or incorrect items.`
      : "Returns are accepted if an item arrives damaged, defective, or different from what you ordered."

  const invoiceSummary = gstActive(shop)
    ? `Yes — all product prices are inclusive of ${shop.gstRate}% GST, and once signed in you can download a GST Tax Invoice directly from My Orders.`
    : "Yes — every confirmed order includes a downloadable printable order invoice from My Orders when you sign in."

  const studioOrigin = [shop.city, shop.region].filter(Boolean).join(", ")
  const tokens: Record<string, string> = {
    shopName: shop.shopName,
    shippingSummary,
    expiryText,
    returnSummary,
    invoiceSummary,
    studioOriginPhrase: studioOrigin ? ` from ${studioOrigin}` : "",
    orderCodePrefix: shop.orderCodePrefix,
  }

  return (faqData.items as RawFaqEntry[]).map((entry) => ({
    id: entry.id,
    category: entry.category,
    categoryLabel: CATEGORY_LABEL_BY_KEY.get(entry.category) ?? entry.category,
    defaultOpen: entry.defaultOpen,
    question: interpolateFaqText(entry.question, tokens),
    answer: interpolateFaqText(entry.answer, tokens),
    linkHref: entry.link?.href,
    linkLabel: entry.link?.label,
  }))
}

export function FaqView({ shop }: { shop: StoreSettings }) {
  const faqs = buildStoreFaqs(shop)
  const [activeCategory, setActiveCategory] = useState<FaqCategoryKey>(FAQ_CATEGORIES[0]?.key ?? "all")
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const item of faqs) {
      if (item.defaultOpen) initial[item.id] = true
    }
    return initial
  })

  const normalizedQuery = query.trim().toLowerCase()
  const filteredFaqs = faqs.filter((item) => {
    if (activeCategory !== "all" && item.category !== activeCategory) return false
    if (normalizedQuery.length >= 2) {
      const haystack = `${item.question} ${item.answer} ${item.categoryLabel}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    }
    return true
  })

  const toggleItem = (id: string) => {
    setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const countForCategory = (cat: FaqCategoryKey) =>
    cat === "all" ? faqs.length : faqs.filter((f) => f.category === cat).length

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <JsonLd data={faqJsonLd} />
      <PageHeader
        title="Frequently asked questions"
        description={`Everything you need to know about ordering, UPI payments, delivery across India, returns, and product care at ${shop.shopName}.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "FAQs" }]}
      />

      <div className={styles.faqPageContainer}>
        {/* Search & Category Filter Tabs */}
        <div className={styles.faqToolbarCard}>
          <SearchField
            label="Search frequently asked questions"
            pill
            maxLength={LIMITS.search.max}
            containerClassName={styles.faqSearchField}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            placeholder="Search questions (e.g. UPI payment, free delivery, return window, custom gift)…"
          />

          <PillTabs
            role="tablist"
            ariaLabel="FAQ topics"
            value={activeCategory}
            onChange={setActiveCategory}
            items={FAQ_CATEGORIES.map((cat) => ({
              value: cat.key,
              label: cat.label,
              icon: cat.Icon,
              count: countForCategory(cat.key),
            }))}
          />
        </div>

        {/* Accordion Q&A List */}
        {filteredFaqs.length === 0 ? (
          <div className={styles.faqEmptyCard}>
            <p className={styles.faqEmptyTitle}>No matching questions found</p>
            <p className={styles.faqEmptySub}>
              Try clearing your search filter or chat directly with us on WhatsApp for quick help.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("")
                setActiveCategory("all")
              }}
              className={styles.faqResetBtn}
            >
              <RotateCcwIcon className={styles.faqInlineIcon} aria-hidden /> Show all questions
            </Button>
          </div>
        ) : (
          <div className={styles.faqListSection}>
            {filteredFaqs.map((item) => {
              const isOpen = Boolean(openIds[item.id]) || normalizedQuery.length >= 2
              const panelId = `faq-panel-${item.id}`
              const triggerId = `faq-trigger-${item.id}`
              return (
                <article
                  key={item.id}
                  className={cn(styles.faqAccordionCard, isOpen && styles.faqAccordionCardOpen)}
                >
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleItem(item.id)}
                    className={styles.faqTriggerBtn}
                  >
                    <div className={styles.faqTriggerLeft}>
                      <span className={styles.faqCategoryPill}>{item.categoryLabel}</span>
                      <h2 className={styles.faqQuestionTitle}>{item.question}</h2>
                    </div>
                    <span className={cn(styles.faqChevronCircle, isOpen && styles.faqChevronCircleOpen)}>
                      <ChevronDownIcon className={styles.faqChevronSvg} aria-hidden />
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={triggerId}
                      className={styles.faqAnswerPanel}
                    >
                      <p className={styles.faqAnswerText}>{item.answer}</p>
                      {item.linkHref && item.linkLabel && (
                        <Link href={item.linkHref} className={styles.faqAnswerLink}>
                          <span>{item.linkLabel}</span>
                          <ArrowRightIcon className={styles.faqInlineIcon} aria-hidden />
                        </Link>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {/* Bottom Direct Support CTA Banner */}
        <div className={styles.faqSupportBanner}>
          <div className={styles.faqSupportCopy}>
            <p className={styles.faqSupportEyebrow}>Direct store support</p>
            <h2 className={styles.faqSupportHeading}>Still have a question?</h2>
            <p className={styles.faqSupportSub}>
              Chat directly with {shop.shopName} on WhatsApp for custom gift requests, product photos, or order assistance.
            </p>
          </div>

          <div className={styles.faqSupportActions}>
            <a
              href={shopWhatsappLink(shop, `Hi ${shop.shopName}, I have a question:`)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "whatsapp", size: "lg" })}
            >
              <WhatsAppIcon aria-hidden="true" /> Chat on WhatsApp
            </a>
            <Link
              href="/contact"
              className={cn(buttonVariants({ variant: "outline" }), styles.faqSecondaryCta)}
            >
              <span>Contact us</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

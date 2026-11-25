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
import { WhatsAppIcon } from "@/components/store/brand-icons"
import { PageHeader } from "@/components/store/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { gstActive } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import styles from "./faq-view.module.css"

export type FaqCategoryKey = "all" | "orders" | "shipping" | "returns" | "handmade"

export type FaqItem = {
  id: string
  category: Exclude<FaqCategoryKey, "all">
  categoryLabel: string
  question: string
  answer: string
  linkHref?: string
  linkLabel?: string
}

const FAQ_CATEGORIES: {
  key: FaqCategoryKey
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  { key: "all", label: "All questions", icon: HelpCircleIcon },
  { key: "orders", label: "Orders & UPI", icon: ShieldCheckIcon },
  { key: "shipping", label: "Shipping & Delivery", icon: TruckIcon },
  { key: "returns", label: "Returns & Refunds", icon: RotateCcwIcon },
  { key: "handmade", label: "Handmade & Custom", icon: SparklesIcon },
]

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
      : "Because each piece is handcrafted in small batches, returns are only accepted if an item arrives damaged or incorrect."

  const invoiceSummary = gstActive(shop)
    ? `Yes — all product prices are inclusive of ${shop.gstRate}% GST, and once signed in you can download a GST Tax Invoice directly from My Orders.`
    : "Yes — every confirmed order includes a downloadable printable order invoice from My Orders when you sign in."

  const studioOrigin = [shop.city, shop.region].filter(Boolean).join(", ")

  return [
    {
      id: "how-to-order-upi",
      category: "orders",
      categoryLabel: "Orders & UPI",
      question: "How do I place an order and pay by UPI?",
      answer: `Add your favourite pieces to the cart, enter your delivery address at checkout, scan the UPI QR code or tap any UPI app (Google Pay, PhonePe, Paytm, BHIM), and enter your 12-digit UTR / UPI reference number to place your order with ${shop.shopName}.`,
      linkHref: "/products",
      linkLabel: "Browse the collection",
    },
    {
      id: "order-reservation-window",
      category: "orders",
      categoryLabel: "Orders & UPI",
      question: "How is my UPI payment verified?",
      answer: `${expiryText} Once verified, our studio confirms your order and shares live courier tracking updates.`,
    },
    {
      id: "cod-availability",
      category: "orders",
      categoryLabel: "Orders & UPI",
      question: "Do you offer Cash on Delivery (COD)?",
      answer:
        "Because every piece is crafted in small artisan batches and packed specifically for each buyer, we operate strictly on prepaid UPI orders. You can chat directly with us on WhatsApp before paying if you have any questions about an item.",
    },
    {
      id: "gst-invoice",
      category: "orders",
      categoryLabel: "Orders & UPI",
      question: "Do I get an invoice for my purchase?",
      answer: invoiceSummary,
      linkHref: "/account/orders",
      linkLabel: "Open My Orders",
    },
    {
      id: "shipping-charges",
      category: "shipping",
      categoryLabel: "Shipping & Delivery",
      question: "What are the delivery charges and when is shipping free?",
      answer: `${shippingSummary} Any protective fragile-packaging or heavy-parcel handling fee is calculated transparently at checkout before you place your order.`,
    },
    {
      id: "delivery-timeline",
      category: "shipping",
      categoryLabel: "Shipping & Delivery",
      question: "How long does delivery take across India?",
      answer: `Orders are carefully packed and dispatched from our studio${studioOrigin ? ` in ${studioOrigin}` : ""} within 1–3 business days of payment confirmation. Tracked courier delivery typically reaches metro cities in 3–5 business days and other pin codes in 5–7 business days.`,
    },
    {
      id: "how-to-track-order",
      category: "shipping",
      categoryLabel: "Shipping & Delivery",
      question: "How can I track my order without signing in?",
      answer: `Use our Track Order page with your order code (e.g. ${shop.orderCodePrefix}-XXXXXX) and the last 4 digits of the phone number used at checkout to see live status updates, courier AWB number, and tracking links.`,
      linkHref: "/track",
      linkLabel: "Go to Track Order",
    },
    {
      id: "returns-and-replacements",
      category: "returns",
      categoryLabel: "Returns & Refunds",
      question: "What is your return and replacement policy?",
      answer: `${returnSummary} To ensure a smooth resolution, please record a short unboxing video when opening the parcel and submit a return request from your Order page or via WhatsApp.`,
      linkHref: "/refund-policy",
      linkLabel: "Read full Refund & Return Policy",
    },
    {
      id: "refund-processing-time",
      category: "returns",
      categoryLabel: "Returns & Refunds",
      question: "How and when are refunds processed?",
      answer:
        "Once a return is inspected or an order is cancelled before dispatch, refunds are sent straight back to your original UPI ID or bank account within 2–5 business days, along with a reference UTR number.",
    },
    {
      id: "handmade-variations",
      category: "handmade",
      categoryLabel: "Handmade & Custom",
      question: "Why might my piece look slightly different from the photos?",
      answer:
        "Every item is shaped, painted, or finished by hand rather than by factory moulds. Subtle variations in glaze, brush strokes, wood grain, or weave are natural hallmarks of authentic handmade craft — making your piece truly one of a kind.",
      linkHref: "/about",
      linkLabel: "Read our artisan story",
    },
    {
      id: "custom-and-bulk-gifting",
      category: "handmade",
      categoryLabel: "Handmade & Custom",
      question: "Do you take custom orders or bulk festive & wedding gifting?",
      answer: `Yes! We love working on custom colour palettes, personalised gift notes, and curated wedding or corporate hampers. Reach out to ${shop.shopName} on WhatsApp with your quantity and timeline for a custom quote.`,
      linkHref: "/contact",
      linkLabel: "Contact us for custom orders",
    },
    {
      id: "verified-customer-reviews",
      category: "handmade",
      categoryLabel: "Handmade & Custom",
      question: "Who can post a product review on the store?",
      answer:
        "Only customers who have received a delivered order for that specific product can rate and review it. This guarantees that every rating and aspect highlight you see comes from a 100% verified buyer.",
    },
  ]
}

export function FaqView({ shop }: { shop: StoreSettings }) {
  const faqs = buildStoreFaqs(shop)
  const [activeCategory, setActiveCategory] = useState<FaqCategoryKey>("all")
  const [query, setQuery] = useState("")
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => ({
    [faqs[0]?.id ?? "how-to-order-upi"]: true,
    [faqs[4]?.id ?? "shipping-charges"]: true,
  }))

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
        description={`Everything you need to know about ordering, UPI payments, delivery across India, returns, and handmade care at ${shop.shopName}.`}
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

          <div className={styles.faqCategoryTabs} role="tablist" aria-label="FAQ topics">
            {FAQ_CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const active = activeCategory === cat.key
              const count = countForCategory(cat.key)
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveCategory(cat.key)}
                  className={cn(styles.faqTabBtn, active && styles.faqTabBtnActive)}
                >
                  <Icon className={styles.faqTabIcon} aria-hidden />
                  <span>{cat.label}</span>
                  <span className={cn(styles.faqTabCount, active && styles.faqTabCountActive)}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
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
            <p className={styles.faqSupportEyebrow}>Personal artisan support</p>
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
              className={styles.faqWhatsappCta}
            >
              <WhatsAppIcon className={styles.faqActionIcon} /> Chat on WhatsApp
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

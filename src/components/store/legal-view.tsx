import { FileTextIcon, LockIcon, RotateCcwIcon, ScaleIcon, ShieldCheckIcon, SparklesIcon, TruckIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/store/page-header"
import { shopWhatsappLink } from "@/features/orders/whatsapp"
import { gstActive, priceNote } from "@/features/settings/tax"
import type { StoreSettings } from "@/features/settings/types"
import { formatPrice } from "@/lib/format"
import { cn } from "@/lib/utils"
import styles from "./legal-view.module.css"

type LegalTab = "privacy" | "terms" | "refund"

const POLICY_TABS: { id: LegalTab; label: string; href: string; icon: typeof ShieldCheckIcon }[] = [
  { id: "privacy", label: "Privacy Policy", href: "/privacy", icon: LockIcon },
  { id: "terms", label: "Terms of Service", href: "/terms", icon: ScaleIcon },
  { id: "refund", label: "Refund & Return Policy", href: "/refund-policy", icon: RotateCcwIcon },
]

function LegalTabsNav({ active }: { active: LegalTab }) {
  return (
    <nav aria-label="Legal and store policies" className={styles.policyTabsNav}>
      {POLICY_TABS.map((t) => {
        const isCurrent = t.id === active
        return (
          <Link

            key={t.id}
            href={t.href}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(styles.policyTabLink, isCurrent && styles.policyTabActive)}
          >
            <t.icon className={styles.tabIcon} aria-hidden />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

function BusinessContactSidebar({ shop }: { shop: StoreSettings }) {
  const businessName = shop.legalName?.trim() || shop.shopName
  const place = [shop.city, shop.region].filter(Boolean).join(", ")
  const fullAddress = shop.businessAddress?.trim() || place || "India"
  const phoneDisplay = shop.phone?.trim() || (shop.whatsappNumber ? `+${shop.whatsappNumber}` : null)
  const hasGst = gstActive(shop)

  return (
    <aside className={styles.sidebarCard} aria-label="Business and grievance contact details">
      <p className={styles.sidebarEyebrow}>Grievance &amp; Legal Contact</p>
      <h2 className={styles.sidebarTitle}>{businessName}</h2>
      <p className={styles.sidebarSub}>
        For privacy inquiries, order support, copyright notices, or consumer grievance redressal, reach out directly to us.
      </p>

      <dl className={styles.metaList}>
        <div className={styles.metaRow}>
          <dt className={styles.metaTerm}>Store / Legal Entity</dt>
          <dd className={styles.metaDesc}>{businessName}</dd>
        </div>

        <div className={styles.metaRow}>
          <dt className={styles.metaTerm}>Studio / Registered Address</dt>
          <dd className={styles.metaDesc}>{fullAddress}</dd>
        </div>

        {hasGst && shop.gstin && (
          <div className={styles.metaRow}>
            <dt className={styles.metaTerm}>GSTIN</dt>
            <dd className={styles.metaDesc}>{shop.gstin}</dd>
          </div>
        )}

        {shop.email && (
          <div className={styles.metaRow}>
            <dt className={styles.metaTerm}>Email Support</dt>
            <dd className={styles.metaDesc}>
              <a href={`mailto:${shop.email}`} className={styles.accentLink}>
                {shop.email}
              </a>
            </dd>
          </div>
        )}

        {phoneDisplay && (
          <div className={styles.metaRow}>
            <dt className={styles.metaTerm}>Phone / WhatsApp</dt>
            <dd className={styles.metaDesc}>
              <a

                href={shopWhatsappLink(shop, `Hi ${shop.shopName}! I have a question regarding your store policies.`)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.accentLink}
              >
                {phoneDisplay} (Chat on WhatsApp)
              </a>
            </dd>
          </div>
        )}
      </dl>

      <div className={styles.selfServiceBox}>
        <p className={styles.selfServiceHeading}>Self-service data controls</p>
        <p className={styles.selfServiceText}>
          Signed-in customers can download a readable, printable summary of their account data or deactivate their account anytime from{" "}
          <Link href="/account/profile" className={styles.inlineLink}>
            Account &amp; Profile
          </Link>
          .
        </p>
      </div>
    </aside>
  )
}

function Bullet({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <li className={styles.bulletItem}>
      <span className={styles.bulletDot} aria-hidden />
      <span>
        {label ? <strong className={styles.strongLabel}>{label}: </strong> : null}
        {children}
      </span>
    </li>
  )
}

export function PrivacyPolicyView({ shop }: { shop: StoreSettings }) {
  const expiryHours = shop.unpaidOrderExpiryHours || 24

  return (
    <>
      <PageHeader
        title="Privacy Policy"
        description={`How ${shop.shopName} collects, uses, retains, and protects your personal information.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Privacy Policy" }]}
      />
      <div className={styles.legalContainer}>
        <LegalTabsNav active="privacy" />

        <div className={styles.highlightsGrid}>
          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <ShieldCheckIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>Zero ad trackers</h2>
            <p className={styles.highlightBody}>
              We do not run third-party advertising pixels, cross-site trackers, or sell your personal data to anyone.
            </p>
          </div>

          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <SparklesIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>No AI training on your data</h2>
            <p className={styles.highlightBody}>
              Your personal details, addresses, order history, and messages are never used to train artificial intelligence models.
            </p>
          </div>

          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <FileTextIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>Full data portability</h2>
            <p className={styles.highlightBody}>
              Download your complete account and order summary in a readable, printable format or deactivate your account anytime from your profile.
            </p>
          </div>
        </div>

        <div className={styles.contentLayout}>
          <div className={styles.clausesStack}>
            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>1. Information We Collect (Data Minimization)</h2>
              <p className={styles.clauseText}>
                We collect only the minimum information required to fulfil your handmade orders, verify UPI payments, and provide customer support:
              </p>
              <ul className={styles.bulletList}>
                <Bullet label="Account details (optional)">
                  Your full name, email address, and mobile number when you create an account or sign in with Google.
                </Bullet>
                <Bullet label="Order &amp; delivery details">
                  Recipient name, 10-digit Indian mobile number, street address, city/district, state, 6-digit pincode, and optional order notes.
                </Bullet>
                <Bullet label="Payment verification reference">
                  Your 12-digit UPI / UTR reference number submitted at checkout. We never collect or store bank passwords, UPI PINs, or card numbers.
                </Bullet>
                <Bullet label="Essential browser storage">
                  Your shopping cart (<code>kk-cart</code>), wishlist (<code>kk-wishlist</code>), theme preference, and authentication session cookies so the store works seamlessly across refreshes.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>2. How We Use Your Information &amp; Zero Marketing Spam</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Order fulfilment &amp; shipping">
                  To pack, ship, and deliver your order via our courier partners and share tracking updates on WhatsApp or your order page.
                </Bullet>
                <Bullet label="Payment &amp; refund verification">
                  To match your 12-digit UTR reference against our bank statement and process returns or refunds.
                </Bullet>
                <Bullet label="No unsolicited marketing emails">
                  We only send transactional emails when you explicitly request them (such as password reset or email change confirmation). We do not send promotional email blasts.
                </Bullet>
                <Bullet label="No unauthorized AI training">
                  Customer records are strictly isolated for store operations and are never shared with or used to train external AI/ML models.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>3. Data Retention Limits</h2>
              <p className={styles.clauseText}>
                We retain personal data only as long as necessary for the purpose collected and to comply with Indian tax and e-commerce laws:
              </p>
              <ul className={styles.bulletList}>
                <Bullet label="Orders &amp; tax invoices">
                  Retained for up to 8 years as required under Indian accounting and GST record-keeping regulations.
                </Bullet>
                <Bullet label="Unpaid pending orders">
                  Automatically cancelled after {expiryHours} hours if payment verification fails or remains unsubmitted, immediately releasing reserved stock.
                </Bullet>
                <Bullet label="Account &amp; saved addresses">
                  Kept while your account is active. You can edit or delete saved addresses anytime, or deactivate your account from <code>/account/profile</code>.
                </Bullet>
                <Bullet label="Security &amp; rate-limit logs">
                  Hashed IP rate-limit counters (salted with a secret key; raw IPs are never stored) expire automatically after their short security window.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>4. Subprocessors &amp; Infrastructure Partners</h2>
              <p className={styles.clauseText}>
                We use the following trusted infrastructure providers solely to host the store, authenticate users, and deliver orders:
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.legalTable}>
                  <thead>
                    <tr className={styles.trRow}>
                      <th className={styles.thCell}>Provider</th>
                      <th className={styles.thCell}>Purpose</th>
                      <th className={styles.thCell}>Data Processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={styles.trRow}>
                      <td className={styles.tdCell}><span className={styles.providerName}>Supabase</span></td>
                      <td className={styles.tdCell}>Database, Authentication &amp; Product Image Storage</td>
                      <td className={styles.tdCell}>Account profile, orders, addresses, wishlist, auth tokens</td>
                    </tr>
                    <tr className={styles.trRow}>
                      <td className={styles.tdCell}><span className={styles.providerName}>Vercel</span></td>
                      <td className={styles.tdCell}>Web Application Hosting &amp; Edge Delivery</td>
                      <td className={styles.tdCell}>HTTP requests, security headers, encrypted TLS traffic</td>
                    </tr>
                    <tr className={styles.trRow}>
                      <td className={styles.tdCell}><span className={styles.providerName}>Google OAuth</span></td>
                      <td className={styles.tdCell}>Optional 1-Tap Customer Sign-In</td>
                      <td className={styles.tdCell}>Name, email address, and profile avatar (only if chosen)</td>
                    </tr>
                    <tr className={styles.trRow}>
                      <td className={styles.tdCell}><span className={styles.providerName}>India Post API</span></td>
                      <td className={styles.tdCell}>Pincode to City/State Autofill</td>
                      <td className={styles.tdCell}>6-digit Indian postal pincode only (no personal identifiers)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>5. Your Data Rights &amp; Children&apos;s Privacy</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Access &amp; data portability">
                  You can view all your orders, addresses, and profile details online and download a readable, printable summary from your{" "}
                  <Link href="/account/profile" className={styles.strongLabel}>
                    Account Profile
                  </Link>
                  .
                </Bullet>
                <Bullet label="Correction &amp; deactivation">
                  You can update your name, phone, email, and addresses at any time, or deactivate your account once active orders are completed.
                </Bullet>
                <Bullet label="Children's privacy (18+)">
                  Our store is intended for individuals aged 18 and above (or under parent/legal guardian supervision). We do not knowingly collect personal data from children without guardian consent.
                </Bullet>
              </ul>
            </section>
          </div>

          <BusinessContactSidebar shop={shop} />
        </div>
      </div>
    </>
  )
}

export function TermsOfServiceView({ shop }: { shop: StoreSettings }) {
  const taxSummary = priceNote(shop) || "All product prices displayed on the store are final."
  const expiryHours = shop.unpaidOrderExpiryHours || 24

  return (
    <>
      <PageHeader
        title="Terms of Service"
        description={`Terms and conditions governing your use of ${shop.shopName} and purchases made on our store.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Terms of Service" }]}
      />
      <div className={styles.legalContainer}>
        <LegalTabsNav active="terms" />

        <div className={styles.contentLayout}>
          <div className={styles.clausesStack}>
            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>1. Handmade Artisanal Products</h2>
              <p className={styles.clauseText}>
                Every piece at {shop.shopName} is crafted by hand in small batches. Because our products are handmade rather than mass-produced, subtle variations in colour, texture, glaze, weave, or dimensions are natural characteristics of artisanal work and not manufacturing defects.
              </p>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>2. Transparent Pricing &amp; No Hidden Fees</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Upfront pricing">
                  {taxSummary} Any applicable delivery fee or special handling surcharge (for fragile, oversized, or heavy parcels) is clearly itemised on the product page, cart, and checkout before you pay.
                </Bullet>
                <Bullet label="Promo codes">
                  Promotional discount codes are subject to their stated minimum order value, maximum discount cap, and validity period.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>3. UPI Payment &amp; 12-Digit UTR Verification</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Prepaid UPI orders only">
                  Orders are paid via UPI at checkout; Cash on Delivery (COD) is not offered.
                </Bullet>
                <Bullet label="Unique 12-digit UTR">
                  To place an order, you must complete the UPI payment and enter the valid 12-digit UTR / UPI reference number. Each UTR can only be used once.
                </Bullet>
                <Bullet label="Manual verification &amp; auto-expiry">
                  Our team verifies every UTR against our bank/UPI statement before moving the order to Confirmed. If a UTR is invalid or unpaid, we will notify you so you can submit a corrected UTR within {expiryHours} hours before automatic cancellation.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>4. Order Cancellation &amp; Verified Reviews</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Customer cancellation">
                  You may cancel your order directly from your Order page or Track Order page while the order status is Pending or Confirmed (before it is packed for dispatch).
                </Bullet>
                <Bullet label="Genuine verified reviews">
                  Only customers who have received a delivered order for a product may submit a star rating and review on our store. Fake or unverified reviews are strictly prohibited.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>5. Intellectual Property, Copyright &amp; Governing Law</h2>
              <p className={styles.clauseText}>
                All product photography, brand logos, text, and designs on {shop.shopName} are the intellectual property of {shop.legalName?.trim() || shop.shopName}. If you believe any content on this site infringes your copyright, please contact us using the Grievance &amp; Legal Contact details on this page. These terms are governed by the laws of India.
              </p>
            </section>
          </div>

          <BusinessContactSidebar shop={shop} />
        </div>
      </div>
    </>
  )
}

export function RefundPolicyView({ shop }: { shop: StoreSettings }) {
  const returnDays = shop.returnWindowDays
  const deliveryText =
    shop.freeDeliveryAbove > 0
      ? `Free delivery on orders of ${formatPrice(shop.freeDeliveryAbove)} or above; otherwise a flat ${formatPrice(shop.deliveryFee)} delivery fee applies.`
      : `A flat ${formatPrice(shop.deliveryFee)} delivery fee applies per order.`

  return (
    <>
      <PageHeader
        title="Refund, Return & Shipping Policy"
        description={`Clear, fair shipping, return, exchange, and refund terms for ${shop.shopName} orders.`}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Refund & Return Policy" }]}
      />
      <div className={styles.legalContainer}>
        <LegalTabsNav active="refund" />

        <div className={styles.highlightsGrid}>
          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <RotateCcwIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>
              {returnDays > 0 ? `${returnDays}-day return window` : "Damaged-in-transit protection"}
            </h2>
            <p className={styles.highlightBody}>
              {returnDays > 0
                ? `Request a return or exchange within ${returnDays} days of delivery directly from My Orders or Track Order.`
                : "If an item arrives damaged in transit, contact us on WhatsApp for immediate replacement or refund assistance."}
            </p>
          </div>

          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <TruckIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>Tracked doorstep delivery</h2>
            <p className={styles.highlightBody}>
              {deliveryText} Every shipment includes courier and AWB tracking details.
            </p>
          </div>

          <div className={styles.highlightCard}>
            <span className={styles.highlightIconBox}>
              <ShieldCheckIcon className={styles.highlightSvg} aria-hidden />
            </span>
            <h2 className={styles.highlightTitle}>Direct UPI refunds</h2>
            <p className={styles.highlightBody}>
              Approved refunds are sent back to your original UPI / bank account with a verifiable refund reference number.
            </p>
          </div>
        </div>

        <div className={styles.contentLayout}>
          <div className={styles.clausesStack}>
            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>1. Return &amp; Exchange Eligibility</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Return window">
                  {returnDays > 0
                    ? `Most items can be returned or exchanged within ${returnDays} ${returnDays === 1 ? "day" : "days"} of the delivery date. Individual products may specify a custom return window on their product page.`
                    : "Items are non-returnable once delivered unless they arrive damaged or defective in transit."}
                </Bullet>
                <Bullet label="Item condition">
                  Returned items must be unused, in their original condition, and packed safely with all original tags and protective packaging intact.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>2. How to Request a Return or Exchange (4-Step Process)</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Step 1 — Submit Request">
                  Open your order in <Link href="/account/orders" className={styles.strongLabel}>My Orders</Link> or{" "}
                  <Link href="/track" className={styles.strongLabel}>Track Order</Link>, choose the item(s) and quantity, select Refund or Exchange/Replacement, and pick your preferred pickup address.
                </Bullet>
                <Bullet label="Step 2 — Approval &amp; Pickup Schedule">
                  Our team reviews your request and schedules a doorstep pickup date (shown on your order timeline).
                </Bullet>
                <Bullet label="Step 3 — Pickup &amp; Quality Check">
                  Once the courier picks up the parcel and it reaches our studio in original condition, we mark the return as received.
                </Bullet>
                <Bullet label="Step 4 — Refund or Replacement">
                  We process your UPI refund (or dispatch your replacement piece) and record the refund reference number on your order page.
                </Bullet>
              </ul>
            </section>

            <section className={styles.clauseCard}>
              <h2 className={styles.clauseHeading}>3. Refund Calculation (Item Value vs. Shipping Charges)</h2>
              <ul className={styles.bulletList}>
                <Bullet label="Returned orders after delivery">
                  For delivered orders returned by the customer, the refund covers the <strong>price paid for the returned item(s) only</strong>. Original delivery fees and special handling charges are non-refundable and are clearly itemised in your Refund Summary card.
                </Bullet>
                <Bullet label="Cancelled orders before dispatch">
                  If an order is cancelled while Pending or Confirmed (before shipping) and you have already paid via UPI, 100% of the amount paid (including delivery and handling charges) is refunded.
                </Bullet>
              </ul>
            </section>
          </div>

          <BusinessContactSidebar shop={shop} />
        </div>
      </div>
    </>
  )
}


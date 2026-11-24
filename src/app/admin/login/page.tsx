import type { Metadata } from "next"
import { ArrowLeftIcon, BarChart3Icon, PackageCheckIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"
import { Suspense } from "react"
import styles from "@/components/admin/admin-core.module.css"
import { AdminLoginForm } from "@/components/admin/admin-login-form"
import { LogoMark } from "@/components/shared/logo"
import { getStoreSettings } from "@/features/settings/queries"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Sign in" }

export default async function AdminLoginPage() {
  const shop = await getStoreSettings()
  return (
    <main className={styles.loginPage}>
      <div className={styles.loginFormColumn}>
        <div className={styles.loginTopRow}>
          <div className={styles.loginBrandGroup}>
            <LogoMark className={styles.logoMark40} />
            <div>
              <p className={styles.shopNameTitle}>{shop.shopName}</p>
              <p className={styles.workspaceSubtitle}>Admin Workspace</p>
            </div>
          </div>
          <Link href="/" className={styles.storefrontBackPill}>
            <ArrowLeftIcon className={styles.icon14} /> Storefront
          </Link>
        </div>

        <div className={styles.loginCardWrap}>
          <div className={cn("adminCard", styles.authCardBox)}>
            <span className={styles.authBadgePrimary}>
              <ShieldCheckIcon className={styles.icon14} aria-hidden /> Secure Admin Access
            </span>
            <h1 className={styles.loginHeading}>
              Welcome back
            </h1>
            <p className={styles.authDescription}>
              Sign in to manage {shop.shopName} orders, catalogue, payments, and store settings.
            </p>
            <Suspense>
              <AdminLoginForm />
            </Suspense>
          </div>
        </div>

        <p className={styles.loginFooterNote}>
          Protected by role-based access control &amp; 4-digit Quick PIN lock.
        </p>
      </div>

      <aside className={cn("adminAuthShowcase", styles.loginShowcaseAside)}>
        <div className={styles.showcaseInner}>
          <div className={styles.showcaseHeader}>
            <p className={styles.showcaseKicker}>Operations Hub</p>
            <h2 className={styles.showcaseTitle}>
              Everything your store needs, in one calm workspace.
            </h2>
            <p className={styles.showcaseLead}>
              Built for fast daily operations — from verifying UPI payments and packing orders to keeping stock and storefront settings up to date.
            </p>
          </div>
          <div className={styles.showcaseCardsGrid}>
            <div className={cn("adminCard", styles.showcaseFeatureCard)}>
              <span className={styles.featureIconSky}>
                <PackageCheckIcon className={styles.icon20} aria-hidden />
              </span>
              <div>
                <p className={styles.featureCardTitle}>Order &amp; Payment Verification</p>
                <p className={styles.featureCardBody}>Review UTRs, update fulfilment stages, manage returns, and print invoices.</p>
              </div>
            </div>
            <div className={cn("adminCard", styles.showcaseFeatureCard)}>
              <span className={styles.featureIconEmerald}>
                <BarChart3Icon className={styles.icon20} aria-hidden />
              </span>
              <div>
                <p className={styles.featureCardTitle}>Live Revenue &amp; Inventory Insights</p>
                <p className={styles.featureCardBody}>Track financial-year revenue, top sellers, and low-stock alerts in real time.</p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}

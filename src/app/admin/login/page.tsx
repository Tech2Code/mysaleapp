import type { Metadata } from "next"
import { ArrowLeftIcon, BarChart3Icon, CheckCircle2Icon, KeyRoundIcon, LockIcon, PackageCheckIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react"
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
      <aside className={cn("adminAuthShowcase", styles.loginShowcaseAside)}>
        <div className={styles.showcaseTopBar}>
          <div className={styles.loginBrandGroup}>
            <LogoMark className={styles.logoMark40} />
            <div>
              <p className={styles.shopNameTitle}>{shop.shopName}</p>
              <p className={styles.workspaceSubtitle}>Operations Console</p>
            </div>
          </div>
          <span className={styles.showcaseLivePill}>
            <span className={styles.showcaseLiveDot} aria-hidden />
            Protected Workspace
          </span>
        </div>

        <div className={styles.showcaseInner}>
          <div className={styles.showcaseHeader}>
            <p className={styles.showcaseKicker}>
              <SparklesIcon className={styles.icon12} aria-hidden /> Operations Hub
            </p>
            <h2 className={styles.showcaseTitle}>
              Everything your store needs, in one calm workspace.
            </h2>
            <p className={styles.showcaseLead}>
              Built for fast daily operations — from verifying UPI payments and packing orders to keeping stock, categories, and storefront settings in sync.
            </p>
          </div>

          <div className={styles.showcaseCardsGrid}>
            <div className={cn("adminCard", styles.showcaseFeatureCard)}>
              <span className={styles.featureIconSky}>
                <PackageCheckIcon className={styles.icon20} aria-hidden />
              </span>
              <div className={styles.featureTextCol}>
                <div className={styles.featureTitleRow}>
                  <p className={styles.featureCardTitle}>Order &amp; Payment Verification</p>
                  <span className={styles.featureTagSky}>Real-time</span>
                </div>
                <p className={styles.featureCardBody}>Review UTR references, update fulfilment stages, process returns, and print GST invoices.</p>
              </div>
            </div>

            <div className={cn("adminCard", styles.showcaseFeatureCard)}>
              <span className={styles.featureIconEmerald}>
                <BarChart3Icon className={styles.icon20} aria-hidden />
              </span>
              <div className={styles.featureTextCol}>
                <div className={styles.featureTitleRow}>
                  <p className={styles.featureCardTitle}>Live Revenue &amp; Inventory Insights</p>
                  <span className={styles.featureTagEmerald}>Analytics</span>
                </div>
                <p className={styles.featureCardBody}>Track financial-year revenue, daily order velocity, top sellers, and low-stock alerts.</p>
              </div>
            </div>

            <div className={cn("adminCard", styles.showcaseFeatureCard)}>
              <span className={styles.featureIconAmber}>
                <KeyRoundIcon className={styles.icon20} aria-hidden />
              </span>
              <div className={styles.featureTextCol}>
                <div className={styles.featureTitleRow}>
                  <p className={styles.featureCardTitle}>Zero-Trust Session &amp; Quick PIN Lock</p>
                  <span className={styles.featureTagAmber}>Security</span>
                </div>
                <p className={styles.featureCardBody}>Protected by role-based access control, audit logs, and an instant 4-digit desk lock.</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.showcaseFooterBar}>
          <span className={styles.showcaseTrustItem}>
            <CheckCircle2Icon className={styles.icon14} aria-hidden /> Role-verified admin guard
          </span>
          <span className={styles.showcaseTrustItem}>
            <LockIcon className={styles.icon14} aria-hidden /> Encrypted session cookies
          </span>
        </div>
      </aside>

      <div className={styles.loginFormColumn}>
        <div className={styles.loginTopRow}>
          <div className={cn(styles.loginBrandGroup, styles.mobileOnlyBrand)}>
            <LogoMark className={styles.logoMark40} />
            <div>
              <p className={styles.shopNameTitle}>{shop.shopName}</p>
              <p className={styles.workspaceSubtitle}>Admin Workspace</p>
            </div>
          </div>
          <Link href="/" className={styles.storefrontBackPill}>
            <ArrowLeftIcon className={styles.icon14} aria-hidden /> Back to storefront
          </Link>
        </div>

        <div className={styles.loginCardWrap}>
          <div className={cn("adminCard", styles.authCardBox)}>
            <div className={styles.authHeaderBlock}>
              <span className={styles.authBadgePrimary}>
                <ShieldCheckIcon className={styles.icon14} aria-hidden /> Secure Admin Access
              </span>
              <h1 className={styles.loginHeading}>
                Welcome back
              </h1>
              <p className={styles.authDescription}>
                Sign in with your administrator credentials to manage {shop.shopName}.
              </p>
            </div>
            <Suspense>
              <AdminLoginForm />
            </Suspense>
          </div>
        </div>

        <p className={styles.loginFooterNote}>
          Protected by role-based access control &amp; 4-digit Quick PIN lock.
        </p>
      </div>
    </main>
  )
}

import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"
import Link from "next/link"
import { AccountSettings } from "@/components/admin/account-forms"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { CategoryManager } from "@/components/admin/category-manager"
import { LaunchPanel } from "@/components/admin/launch-panel"
import { ProductForm } from "@/components/admin/product-form"
import { PromoCodeManager, StoreSettingsForm } from "@/components/admin/store-settings-form"
import { buttonVariants } from "@/components/ui/button"
import type { AdminPinStatus } from "@/features/auth/account-schema"
import type { PaymentGatewayProvider } from "@/features/orders/types"
import type { Category, Product } from "@/features/products/types"
import type { LaunchCounts } from "@/features/settings/launch"
import type { ChecklistItem } from "@/features/settings/launch-queries"
import type { PromoCode, StoreSettings } from "@/features/settings/types"
import { cn } from "@/lib/utils"
import styles from "./admin-core.module.css"

/**
 * The simple admin pages (a header + one client component). Each is rendered by its page with real
 * data and by its loading.tsx with placeholder data inside <Skeletonize>, so both always match.
 */

/** Add product (`product` null) or edit product. */
export function ProductFormView({ product, categories }: { product: Product | null; categories: Pick<Category, "id" | "name">[] }) {
  return (
    <>
      <div className={styles.backNavRow}>
        <Link
          href="/admin/products"
          className={styles.backNavLink}
        >
          <ArrowLeftIcon className={styles.icon14} aria-hidden /> All products
        </Link>
      </div>
      {product ? (
        <AdminPageHeader
          eyebrow="Catalogue"
          title={product.name}
          description="Changes go live on the store as soon as you save."
          actions={
            product.isActive && (
              <Link
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), styles.roundedFullBtn)}
              >
                <ExternalLinkIcon /> View in store
              </Link>
            )
          }
        />
      ) : (
        <AdminPageHeader eyebrow="Catalogue" title="Add product" description="Fill in the details and hit create — it goes live instantly." />
      )}
      <ProductForm product={product} categories={categories} />
    </>
  )
}

export function CategoriesView({ categories }: { categories: (Category & { productCount: number })[] }) {
  return (
    <>
      <AdminPageHeader eyebrow="Catalogue" title="Categories" description="Organise products into collections." />
      <CategoryManager categories={categories} />
    </>
  )
}

export function LaunchView({ counts, checklist }: { counts: LaunchCounts; checklist: ChecklistItem[] }) {
  return (
    <>
      <AdminPageHeader eyebrow="Store" title="Data & launch" description="Check you're ready to go live, and clear the practice data from testing." />
      <LaunchPanel counts={counts} checklist={checklist} />
    </>
  )
}

export function SettingsView({
  settings,
  promoCodes = [],
  configuredGateways = [],
}: {
  settings: StoreSettings
  promoCodes?: PromoCode[]
  configuredGateways?: PaymentGatewayProvider[]
}) {
  return (
    <>
      <AdminPageHeader
        eyebrow="Store"
        title="Settings"
        description="Your shop's name, promo codes, contact details, payment, delivery and SEO. Changes go live on the website as soon as you save."
      />
      <PromoCodeManager promoCodes={promoCodes} />
      <StoreSettingsForm settings={settings} configuredGateways={configuredGateways} />
    </>
  )
}

export function AdminAccountView({
  name,
  phone,
  email,
  pinStatus,
}: {
  name: string
  phone: string
  email: string
  pinStatus?: AdminPinStatus
}) {
  return (
    <>
      <AdminPageHeader eyebrow="Store" title="My account" description="Manage your display name, 4-digit Quick PIN, login email, and password." />
      <AccountSettings name={name} phone={phone} email={email} pinStatus={pinStatus} />
    </>
  )
}

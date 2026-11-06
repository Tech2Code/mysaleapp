import { PlusIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { buttonVariants } from "@/components/ui/button"
import { ORDER_STATUSES, STATUS_META } from "@/features/orders/types"
import {
  ActionBone,
  PageHeaderSkeleton,
  SkeletonCard,
  SkeletonColumn,
  SkeletonField,
  SkeletonLine,
  SkeletonList,
  SkeletonTable,
  SkeletonText,
  bonewidth,
} from "@/components/shared/skeleton-kit"
import { cn } from "@/lib/utils"

/**
 * One skeleton per admin screen. Each mirrors the real page's wrappers, grid and static text
 * (titles, headings, table headers, chip labels); only database-driven content shimmers.
 * When you change a page's layout or table columns, change its skeleton here too.
 */

// ---------------------------------------------------------------- orders list

/** Same columns/classes as the table in `app/admin/(panel)/orders/page.tsx`. */
export const ORDERS_COLUMNS: SkeletonColumn[] = [
  { label: "Order", cell: "text" },
  { label: "Customer", cell: "two-line" },
  { label: "Items", className: "hidden md:table-cell" },
  { label: "Status", cell: "badge" },
  { label: "Payment", className: "hidden lg:table-cell", cell: "badge" },
  { label: "Total", className: "text-right", cell: "number" },
  { label: "Placed", className: "hidden text-right sm:table-cell", cell: "number" },
]

export function OrdersTableSkeleton({ rows = 8 }: { rows?: number }) {
  return <SkeletonTable columns={ORDERS_COLUMNS} rows={rows} />
}

const PAYMENT_LABELS = ["Any payment", "To verify", "Unpaid", "Paid"]

/** Search box + the real status/payment chip labels, inactive. */
function OrdersFiltersSkeleton() {
  return (
    <div data-ui="admin/OrdersFiltersSkeleton" className="mb-4 space-y-3" aria-hidden>
      <Skeleton data-ui="admin/OrdersFiltersSkeleton/Skeleton" className="h-10 max-w-md rounded-xl" />
      <div data-ui="admin/OrdersFiltersSkeleton/div-flex" className="scroll-row flex gap-2">
        {["All", ...ORDER_STATUSES.map((s) => STATUS_META[s].label)].map((label) => (
          <span data-ui="admin/OrdersFiltersSkeleton/span-grid" key={label} className="grid h-9 shrink-0 place-items-center rounded-full border bg-card px-3.5 text-sm leading-none font-medium text-muted-foreground">
            {label}
          </span>
        ))}
      </div>
      <div data-ui="admin/OrdersFiltersSkeleton/div-flex-2" className="scroll-row flex gap-2">
        {PAYMENT_LABELS.map((label) => (
          <span data-ui="admin/OrdersFiltersSkeleton/span-grid-2" key={label} className="grid h-8 shrink-0 place-items-center rounded-full border bg-card px-3 text-xs leading-none font-medium text-muted-foreground">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function OrdersPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton title="Orders" dynamicDescription />
      <OrdersFiltersSkeleton />
      <OrdersTableSkeleton />
    </>
  )
}

// ---------------------------------------------------------------- order detail

export function OrderDetailSkeleton() {
  return (
    <div data-ui="admin/OrderDetailSkeleton" aria-hidden>
      <span data-ui="admin/OrderDetailSkeleton/span-inline-flex" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">← All orders</span>

      <header data-ui="admin/OrderDetailSkeleton/header-flex" className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton" className="h-8 w-44 rounded sm:h-9" />
        <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-2" className="h-9 w-24 rounded-full" />
        <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-3" className="h-7 w-24 rounded-full" />
        <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-4" className="h-7 w-24 rounded-full" />
        <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-5" className="h-4 w-40 rounded" />
      </header>

      <div data-ui="admin/OrderDetailSkeleton/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div data-ui="admin/OrderDetailSkeleton/div" className="min-w-0 space-y-6">
          <SkeletonCard title="Items">
            <div data-ui="admin/OrderDetailSkeleton/div-2" className="space-y-4">
              {[0, 1].map((i) => (
                <div data-ui="admin/OrderDetailSkeleton/div-flex" key={i} className="flex items-center gap-3">
                  <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-6" className="size-14 shrink-0 rounded-xl" />
                  <div data-ui="admin/OrderDetailSkeleton/div-3" className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-7" className={cn("h-4 rounded", bonewidth(i))} />
                    <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-8" className="h-3 w-1/4 rounded" />
                  </div>
                  <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-9" className="h-4 w-16 rounded" />
                </div>
              ))}
              <div data-ui="admin/OrderDetailSkeleton/div-4" className="space-y-2 border-t pt-4">
                <SkeletonLine className="ml-auto w-40" />
                <SkeletonLine className="ml-auto w-32" />
              </div>
            </div>
          </SkeletonCard>

          <SkeletonCard title="Payment">
            <div data-ui="admin/OrderDetailSkeleton/div-5" className="space-y-3">
              <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-10" className="h-10 max-w-xs rounded-xl" />
              <SkeletonText lines={2} />
            </div>
          </SkeletonCard>

          <SkeletonCard title="Fulfilment">
            <div data-ui="admin/OrderDetailSkeleton/div-grid-2" className="grid gap-8 md:grid-cols-2">
              <div data-ui="admin/OrderDetailSkeleton/div-6" className="space-y-3">
                <SkeletonField label="Status" />
                <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-11" className="h-10 w-32 rounded-xl" />
              </div>
              <div data-ui="admin/OrderDetailSkeleton/div-7">
                <h3 data-ui="admin/OrderDetailSkeleton/h3-progress" className="mb-4 text-sm font-medium">Progress</h3>
                <ol data-ui="admin/OrderDetailSkeleton/ol" className="space-y-4">
                  {[0, 1, 2, 3].map((i) => (
                    <li data-ui="admin/OrderDetailSkeleton/li-flex" key={i} className="flex items-center gap-3">
                      <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-12" className="size-6 shrink-0 rounded-full" />
                      <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-13" className={cn("h-4 rounded", bonewidth(i))} />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div data-ui="admin/OrderDetailSkeleton/div-8" className="mt-6 space-y-3 border-t pt-5 sm:max-w-xs">
              <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-14" className="h-10 w-full rounded-xl" />
            </div>
          </SkeletonCard>
        </div>

        <aside data-ui="admin/OrderDetailSkeleton/aside" className="space-y-6">
          <SkeletonCard title="Customer">
            <div data-ui="admin/OrderDetailSkeleton/div-9" className="space-y-2">
              <SkeletonLine className="w-1/2" />
              <SkeletonLine className="w-1/3" />
              <div data-ui="admin/OrderDetailSkeleton/div-flex-2" className="mt-4 flex gap-2">
                <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-15" className="h-9 w-28 rounded-full" />
                <Skeleton data-ui="admin/OrderDetailSkeleton/Skeleton-16" className="h-9 w-20 rounded-full" />
              </div>
            </div>
          </SkeletonCard>
          <SkeletonCard title="Ship to">
            <SkeletonText lines={3} />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonField label="Private note" />
          </SkeletonCard>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- products

/** Same columns/classes as the table in `app/admin/(panel)/products/page.tsx`. */
export const PRODUCTS_COLUMNS: SkeletonColumn[] = [
  { label: "Product", cell: "thumb" },
  { label: "Category", className: "hidden md:table-cell" },
  { label: "Price", className: "text-right", cell: "number" },
  { label: "Stock", className: "hidden text-right sm:table-cell", cell: "number" },
  { label: "Active", className: "text-center", cell: "switch" },
  { label: "Featured", className: "hidden text-center sm:table-cell", cell: "switch" },
  { label: "Actions", className: "text-right", srOnly: true, cell: "number" },
]

export function ProductsPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton
        title="Products"
        dynamicDescription
        actions={
          <span data-ui="admin/ProductsPageSkeleton/span" className={cn(buttonVariants(), "rounded-full px-4 opacity-60")}>
            <PlusIcon /> Add product
          </span>
        }
      />
      <SkeletonTable columns={PRODUCTS_COLUMNS} rows={8} />
    </>
  )
}

/** Edit/new product form: same two-column grid and section headings as `product-form.tsx`. */
export function ProductFormSkeleton({ mode }: { mode: "new" | "edit" }) {
  return (
    <>
      {mode === "new" ? (
        <PageHeaderSkeleton title="Add product" description="Fill in the details and hit create — it goes live instantly." />
      ) : (
        <PageHeaderSkeleton
          title={<Skeleton data-ui="admin/ProductFormSkeleton/Skeleton" className="h-8 w-64 rounded sm:h-9" />}
          description="Changes go live on the store as soon as you save."
        />
      )}
      <div data-ui="admin/ProductFormSkeleton/div-grid" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start" aria-hidden>
        <div data-ui="admin/ProductFormSkeleton/div" className="min-w-0 space-y-6">
          <SkeletonCard title="Basic details">
            <SkeletonField label="Name" />
            <SkeletonField label="Short description" />
          </SkeletonCard>
          <SkeletonCard title="Product details">
            <div data-ui="admin/ProductFormSkeleton/div-2" className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div data-ui="admin/ProductFormSkeleton/div-grid-2" key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[200px_1fr_auto]">
                  <Skeleton data-ui="admin/ProductFormSkeleton/Skeleton-2" className="h-10 rounded-xl" />
                  <Skeleton data-ui="admin/ProductFormSkeleton/Skeleton-3" className="h-10 rounded-xl max-sm:hidden" />
                  <Skeleton data-ui="admin/ProductFormSkeleton/Skeleton-4" className="size-10 rounded-xl" />
                </div>
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard title="Photos" description="Up to 8 photos. The first one is the cover. Good photos sell!">
            <div data-ui="admin/ProductFormSkeleton/div-grid-3" className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton data-ui="admin/ProductFormSkeleton/Skeleton-5" key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          </SkeletonCard>
          <SkeletonCard title="Search engine listing" description="How this product appears on Google. Leave blank to auto-fill.">
            <SkeletonField label="Title" />
            <SkeletonField label="Description" />
          </SkeletonCard>
        </div>
        <aside data-ui="admin/ProductFormSkeleton/aside" className="space-y-6">
          <SkeletonCard title="Visibility">
            <SkeletonText lines={2} />
          </SkeletonCard>
          <SkeletonCard title="Pricing & stock">
            <div data-ui="admin/ProductFormSkeleton/div-grid-4" className="grid grid-cols-2 gap-x-4">
              <SkeletonField label="Price" />
              <SkeletonField label="Stock" />
            </div>
          </SkeletonCard>
          <SkeletonCard title="Extra charges">
            <SkeletonText lines={2} />
          </SkeletonCard>
        </aside>
      </div>
    </>
  )
}

// ---------------------------------------------------------------- categories

export function CategoriesPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton title="Categories" description="Organise products into collections." />
      <div data-ui="admin/CategoriesPageSkeleton/div-flex" className="mb-4 flex justify-end" aria-hidden>
        <ActionBone />
      </div>
      <SkeletonList rows={5} />
    </>
  )
}

// ---------------------------------------------------------------- settings

const SETTINGS_CARDS: { title: string; description: string; fields: number }[] = [
  { title: "Shop profile", description: "Your name and tagline appear in the header, the browser tab, Google results and WhatsApp share previews.", fields: 4 },
  { title: "Social links", description: "Shown in the footer and on the Contact page. Paste the full link.", fields: 4 },
  { title: "Google & SEO", description: "Helps people find your shop by name or by what you sell. Your website address comes from the deployment settings, not from here.", fields: 2 },
  { title: "Contact & WhatsApp", description: "Used on the Contact page, the footer, the WhatsApp button and every WhatsApp message.", fields: 4 },
  { title: "Payment (UPI)", description: "Customers pay this UPI ID after placing an order, then enter the UTR.", fields: 2 },
  { title: "Delivery charges", description: "Applied to every order. Per-product charges (like handling) are set on each product.", fields: 2 },
  { title: "Orders", description: "How your order numbers look, and how long an unpaid order is kept, and the return window.", fields: 3 },
]

/** Same `xl:columns-2` masonry as `store-settings-form.tsx`. */
export function SettingsPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton
        title="Settings"
        description="Your shop's name, contact details, payment, delivery and SEO. Changes go live on the website as soon as you save."
      />
      <div data-ui="admin/SettingsPageSkeleton/div" className="xl:columns-2 xl:gap-6" aria-hidden>
        {SETTINGS_CARDS.map((c) => (
          <SkeletonCard key={c.title} title={c.title} description={c.description} className="mb-6">
            <div data-ui="admin/SettingsPageSkeleton/div-grid" className="grid gap-x-5 sm:grid-cols-2">
              {Array.from({ length: c.fields }, (_, i) => (
                <SkeletonField key={i} />
              ))}
            </div>
          </SkeletonCard>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------- dashboard

/** The numbers under the range picker. Also shown while the range changes. */
export function DashboardBodySkeleton() {
  return (
    <div data-ui="admin/DashboardBodySkeleton" aria-hidden>
      <div data-ui="admin/DashboardBodySkeleton/div-grid" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div data-ui="admin/DashboardBodySkeleton/div-flex" key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
            <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton" className="size-12 shrink-0 rounded-2xl" />
            <div data-ui="admin/DashboardBodySkeleton/div" className="min-w-0 flex-1 space-y-2">
              <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-2" className="h-6 w-10 rounded" />
              <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-3" className={cn("h-3.5 rounded", bonewidth(i))} />
            </div>
          </div>
        ))}
      </div>
      <div data-ui="admin/DashboardBodySkeleton/div-grid-2" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div data-ui="admin/DashboardBodySkeleton/div-2" key={i} className="space-y-3 rounded-2xl border bg-card p-5">
            <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-4" className="h-3.5 w-24 rounded" />
            <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-5" className="h-8 w-32 rounded" />
            <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-6" className="h-3 w-40 rounded" />
          </div>
        ))}
      </div>
      <div data-ui="admin/DashboardBodySkeleton/div-grid-3" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div data-ui="admin/DashboardBodySkeleton/div-3" className="space-y-6">
          <SkeletonCard title="Revenue">
            <Skeleton data-ui="admin/DashboardBodySkeleton/Skeleton-7" className="h-56 w-full rounded-xl" />
          </SkeletonCard>
          <SkeletonCard title="Recent orders">
            <SkeletonList rows={5} />
          </SkeletonCard>
        </div>
        <div data-ui="admin/DashboardBodySkeleton/div-flex-2" className="flex flex-col gap-6">
          <SkeletonCard title="Order pipeline">
            <SkeletonText lines={5} />
          </SkeletonCard>
          <SkeletonCard title="Top products">
            <SkeletonList rows={3} />
          </SkeletonCard>
          <SkeletonCard title="Low stock" className="flex-1">
            <SkeletonList rows={3} />
          </SkeletonCard>
        </div>
      </div>
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div data-ui="admin/DashboardPageSkeleton" aria-hidden>
      <header data-ui="admin/DashboardPageSkeleton/header-flex" className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div data-ui="admin/DashboardPageSkeleton/div" className="space-y-2">
          <Skeleton data-ui="admin/DashboardPageSkeleton/Skeleton" className="h-4 w-36 rounded" />
          <Skeleton data-ui="admin/DashboardPageSkeleton/Skeleton-2" className="h-8 w-64 rounded sm:h-9" />
          <Skeleton data-ui="admin/DashboardPageSkeleton/Skeleton-3" className="h-4 w-56 rounded" />
        </div>
        <div data-ui="admin/DashboardPageSkeleton/div-flex" className="flex flex-wrap gap-2">
          <span data-ui="admin/DashboardPageSkeleton/span" className={cn(buttonVariants({ variant: "outline" }), "rounded-full opacity-60")}>View store</span>
          <span data-ui="admin/DashboardPageSkeleton/span-2" className={cn(buttonVariants(), "rounded-full px-5 opacity-60")}>
            <PlusIcon /> Add product
          </span>
        </div>
      </header>
      <Skeleton data-ui="admin/DashboardPageSkeleton/Skeleton-4" className="mb-6 h-10 w-56 rounded-xl" />
      <DashboardBodySkeleton />
    </div>
  )
}

// ---------------------------------------------------------------- launch / account

export function LaunchPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton title="Data & launch" description="Check you're ready to go live, and clear the practice data from testing." />
      <div data-ui="admin/LaunchPageSkeleton/div-grid" className="grid gap-6 xl:grid-cols-2" aria-hidden>
        <SkeletonCard title="Launch checklist">
          <SkeletonList rows={6} leading="none" />
        </SkeletonCard>
        <SkeletonCard title="Clear test data">
          <SkeletonText lines={4} />
        </SkeletonCard>
      </div>
    </>
  )
}

export function AccountPageSkeleton() {
  return (
    <>
      <PageHeaderSkeleton title="My account" description="Your name, login email and password. No database access needed." />
      <div data-ui="admin/AccountPageSkeleton/div-grid" className="grid gap-6 xl:grid-cols-2" aria-hidden>
        <SkeletonCard title="Profile">
          <SkeletonField label="Name" />
          <SkeletonField label="Phone" />
        </SkeletonCard>
        <SkeletonCard title="Login email">
          <SkeletonField label="Email" />
        </SkeletonCard>
        <SkeletonCard title="Password">
          <SkeletonField label="Current password" />
          <SkeletonField label="New password" />
        </SkeletonCard>
      </div>
    </>
  )
}

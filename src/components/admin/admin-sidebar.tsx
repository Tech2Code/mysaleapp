"use client"

import {
  CommandIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PackageIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RocketIcon,
  SearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagsIcon,
  UserRoundCogIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useState, useSyncExternalStore, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Logo, LogoMark } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOutAdmin } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { AdminGlobalSearch, openAdminGlobalSearch } from "./admin-global-search"
import styles from "./admin-core.module.css"

type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: "orders" }

const SIDEBAR_COLLAPSED_KEY = "admin_sidebar_collapsed"
const SIDEBAR_COLLAPSED_EVENT = "kk-admin-sidebar-collapsed"

function subscribeSidebarCollapsed(cb: () => void) {
  window.addEventListener("storage", cb)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, cb)
  return () => {
    window.removeEventListener("storage", cb)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, cb)
  }
}

function getSidebarCollapsedSnapshot() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

const GROUPS: { title: string; links: NavLink[] }[] = [
  { title: "Workspace", links: [{ href: "/admin", label: "Overview", icon: LayoutDashboardIcon, exact: true }] },
  {
    title: "Operations",
    links: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon, badge: "orders" },
      { href: "/admin/products", label: "Products", icon: PackageIcon },
      { href: "/admin/categories", label: "Categories", icon: TagsIcon },
    ],
  },
  {
    title: "Manage",
    links: [
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
      { href: "/admin/account", label: "My account", icon: UserRoundCogIcon },
      { href: "/admin/launch", label: "Data & launch", icon: RocketIcon },
    ],
  },
]

const ROUTE_TITLES: { match: (p: string) => boolean; label: string; group: string }[] = [
  { match: (p) => p === "/admin", label: "Overview", group: "Workspace" },
  { match: (p) => p.startsWith("/admin/orders/") && p.endsWith("/invoice"), label: "Order Invoice", group: "Operations" },
  { match: (p) => p.startsWith("/admin/orders/"), label: "Order Details", group: "Operations" },
  { match: (p) => p.startsWith("/admin/orders"), label: "Orders", group: "Operations" },
  { match: (p) => p === "/admin/products/new", label: "Add Product", group: "Operations" },
  { match: (p) => p.startsWith("/admin/products/"), label: "Edit Product", group: "Operations" },
  { match: (p) => p.startsWith("/admin/products"), label: "Products", group: "Operations" },
  { match: (p) => p.startsWith("/admin/categories"), label: "Categories", group: "Operations" },
  { match: (p) => p.startsWith("/admin/settings"), label: "Settings", group: "Manage" },
  { match: (p) => p.startsWith("/admin/account"), label: "My Account", group: "Manage" },
  { match: (p) => p.startsWith("/admin/launch"), label: "Data & Launch", group: "Manage" },
]

function NavItems({
  pathname,
  onNavigate,
  ordersBadge,
  collapsed = false,
}: {
  pathname: string | null
  onNavigate?: () => void
  ordersBadge?: ReactNode
  collapsed?: boolean
}) {
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.title} className={styles.navGroupBlock}>
          {!collapsed ? (
            <p className={styles.navGroupTitle}>
              {group.title}
            </p>
          ) : (
            <div className={styles.navGroupDivider} aria-hidden />
          )}
          {group.links.map((l) => {
            const active = pathname !== null && (l.exact ? pathname === l.href : pathname.startsWith(l.href))
            return (
              <Link

                key={l.href}
                href={l.href}
                onClick={onNavigate}
                title={collapsed ? l.label : undefined}
                aria-label={collapsed ? l.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  styles.navItemLink,
                  collapsed ? styles.navItemCollapsed : styles.navItemExpanded,
                  active ? styles.navItemActive : styles.navItemInactive
                )}
              >
                {active && !collapsed && (
                  <span className={styles.navActiveBar} aria-hidden />
                )}
                <l.icon

                  className={active ? styles.navItemIconActive : styles.navItemIcon}
                  aria-hidden
                />
                {!collapsed && <span className={styles.navItemLabel}>{l.label}</span>}
                {l.badge === "orders" && (
                  <span className={cn(collapsed && styles.navBadgeCollapsed)}>{ordersBadge}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}

function NavItemsWithPath(props: { onNavigate?: () => void; ordersBadge?: ReactNode; collapsed?: boolean }) {
  return <NavItems {...props} pathname={usePathname()} />
}

function TopbarBreadcrumb() {
  const pathname = usePathname()
  const match = pathname ? ROUTE_TITLES.find((r) => r.match(pathname)) : null
  if (!match) return null
  return (
    <div className={styles.topbarBreadcrumb}>
      <span className={styles.breadcrumbGroup}>{match.group}</span>
      <span className={styles.breadcrumbSlash} aria-hidden>/</span>
      <span className={styles.breadcrumbPage}>{match.label}</span>
    </div>
  )
}

function SidebarBody({
  onNavigate,
  ordersBadge,
  collapsed = false,
  onToggleCollapse,
  onOpenCommand,
}: {
  onNavigate?: () => void
  ordersBadge?: ReactNode
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenCommand?: () => void
}) {
  const router = useRouter()
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  useBlockWhile(signingOut)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(signingOut)
  return (
    <div className={cn(styles.sidebarBody, collapsed ? styles.sidebarBodyCollapsed : styles.sidebarBodyExpanded)}>
      {/* Same height as the top bar, so the two divider lines meet. */}
      <div

        className={cn(
          styles.sidebarHeaderBar,
          collapsed ? styles.sidebarHeaderCollapsed : styles.sidebarHeaderExpanded
        )}
      >
        {collapsed ? (
          <Link href="/admin" aria-label="Admin home" className={styles.collapsedLogoLink}>
            <LogoMark className={styles.logoMark32} />
          </Link>
        ) : (
          <div className={styles.sidebarLogoWrap}>
            <Logo href="/admin" className={styles.sidebarLogoCustom} />
          </div>
        )}
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className={styles.collapseRailBtn}
          >
            <PanelLeftCloseIcon className={styles.icon16} aria-hidden />
          </button>
        )}
      </div>

      {onToggleCollapse && collapsed && (
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className={styles.expandRailBtn}
        >
          <PanelLeftOpenIcon className={styles.icon16} aria-hidden />
        </button>
      )}

      {onOpenCommand && (
        <button
          type="button"
          onClick={onOpenCommand}
          title={collapsed ? "Quick jump (⌘K)" : undefined}
          aria-label="Quick jump"
          className={cn(
            styles.quickJumpTrigger,
            collapsed ? styles.quickJumpCollapsed : styles.quickJumpExpanded
          )}
        >
          <span className={styles.quickJumpLeft}>
            <SearchIcon className={styles.icon14} aria-hidden />
            {!collapsed && <span>Search…</span>}
          </span>
          {!collapsed && (
            <kbd className={styles.quickJumpKbd}>
              <CommandIcon className={styles.icon10} aria-hidden />K
            </kbd>
          )}
        </button>
      )}

      <nav aria-label="Admin" className={styles.sidebarNav}>
        <Suspense fallback={<NavItems pathname={null} ordersBadge={null} collapsed={collapsed} />}>
          <NavItemsWithPath onNavigate={onNavigate} ordersBadge={ordersBadge} collapsed={collapsed} />
        </Suspense>
      </nav>

      <div className={styles.sidebarFooter}>
        <Link

          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "View store" : undefined}
          aria-label={collapsed ? "View store" : undefined}
          className={cn(
            styles.footerStoreLink,
            collapsed ? styles.footerActionCollapsed : styles.footerActionExpanded
          )}
        >
          <ExternalLinkIcon className={styles.icon16} aria-hidden />
          {!collapsed && <span>View store</span>}
        </Link>
        <button

          type="button"
          onClick={() => setAskSignOut(true)}
          title={collapsed ? "Sign out" : undefined}
          aria-label={collapsed ? "Sign out" : undefined}
          className={cn(
            styles.footerSignOutBtn,
            collapsed ? styles.footerActionCollapsed : styles.footerActionExpanded
          )}
        >
          <LogOutIcon className={styles.icon16} aria-hidden />
          {!collapsed && <span>Sign out</span>}
        </button>
        <ConfirmDialog
          open={askSignOut}
          onOpenChange={(next) => !signingOut && setAskSignOut(next)}
          title="Sign out?"
          description="You will need to sign in again to use the admin panel."
          confirmLabel="Sign out"
          destructive
          pending={signingOut}
          onConfirm={() => {
            setAskSignOut(false)
            startSignOut(async () => {
              try {
                const res = await signOutAdmin()
                if (!res.ok) {
                  toast.error(res.error ?? "Couldn't sign out. Please try again.")
                  return
                }
                applyClientSignOut()
                await getBrowserSupabase()?.auth.signOut({ scope: "local" })
                showSuccess("Signed out")
                later(() => {
                  onNavigate?.()
                  toast.success("Signed out")
                })
                router.replace(res.data.redirectTo)
              } catch {
                toast.error("Couldn't sign out. Please try again.")
              }
            })
          }}
        />
      </div>
    </div>
  )
}

/** Desktop sidebar with collapsible rail and global admin search trigger. */
export function AdminSidebar({ ordersBadge }: { ordersBadge?: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeSidebarCollapsed, getSidebarCollapsedSnapshot, () => false)

  const toggleCollapse = () => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "0" : "1")
      window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
    } catch {}
  }

  return (
    <aside
      className={cn(
        styles.desktopSidebarAside,
        collapsed ? styles.desktopSidebarCollapsed : styles.desktopSidebarExpanded
      )}
    >
      <SidebarBody
        ordersBadge={ordersBadge}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onOpenCommand={openAdminGlobalSearch}
      />
    </aside>
  )
}

/** Top bar: menu button on phones/tablets, breadcrumb on desktop, global search, quick add product, theme toggle and account menu. */
export function AdminTopbar({ ordersBadge, account }: { ordersBadge?: ReactNode; account?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <header className={styles.adminTopbar}>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.mobileMenuBtn)}
            aria-label="Open admin menu"
          >
            <MenuIcon className={styles.icon20} />
          </SheetTrigger>
          <SheetContent side="left" className={styles.mobileDrawerSheet}>
            <SheetHeader className={styles.srOnly}>
              <SheetTitle>Admin menu</SheetTitle>
            </SheetHeader>
            <SidebarBody
              onNavigate={() => setOpen(false)}
              onOpenCommand={() => {
                setOpen(false)
                setSearchOpen(true)
              }}
              ordersBadge={ordersBadge}
            />
          </SheetContent>
        </Sheet>

        <div className={styles.mobileLogoWrap}>
          <Logo href="/admin" />
        </div>

        <Suspense fallback={null}>
          <TopbarBreadcrumb />
        </Suspense>

        <div className={styles.topbarRightActions}>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Global admin search"
            title="Search admin (⌘K)"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.topbarSearchBtn)}
          >
            <SearchIcon className={styles.icon18} aria-hidden />
          </button>
          <Link
            href="/admin/products/new"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), styles.topbarNewProdBtn)}
          >
            <PlusIcon className={styles.icon14} aria-hidden /> New product
          </Link>
          <ThemeToggle className={styles.topbarThemeToggle} />
          {account}
        </div>
      </header>
      <AdminGlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  )
}

function AdminBottomTabs({
  pathname,
  ordersBadge,
  onOpenMore,
}: {
  pathname: string | null
  ordersBadge?: ReactNode
  onOpenMore: () => void
}) {
  const tabs = [
    { key: "dashboard", href: "/admin", label: "Home", icon: LayoutDashboardIcon, active: pathname === "/admin" },
    { key: "orders", href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon, active: pathname?.startsWith("/admin/orders") ?? false, badge: ordersBadge },
    { key: "products", href: "/admin/products", label: "Products", icon: PackageIcon, active: pathname?.startsWith("/admin/products") ?? false },
    { key: "categories", href: "/admin/categories", label: "Categories", icon: TagsIcon, active: pathname?.startsWith("/admin/categories") ?? false },
  ]

  const isMoreActive =
    pathname !== null &&
    (pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/account") || pathname.startsWith("/admin/launch"))

  return (
    <ul className={styles.bottomTabsUl}>
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <li key={tab.key} className={styles.bottomTabLi}>
            <Link

              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                styles.bottomTabAction,
                tab.active ? styles.bottomTabActive : styles.bottomTabInactive
              )}
            >
              <span className={cn(styles.tabPillWrap, tab.active && styles.tabPillActive)}>
                <Icon className={tab.active ? styles.tabIconBold : styles.icon20} aria-hidden />
                {tab.badge && (
                  <span className={styles.tabBadgeOverlay}>{tab.badge}</span>
                )}
              </span>
              <span className={tab.active ? styles.tabTextActive : styles.tabTextLabel}>
                {tab.label}
              </span>
            </Link>
          </li>
        )
      })}
      <li className={styles.bottomTabLi}>
        <button

          type="button"
          onClick={onOpenMore}
          aria-pressed={isMoreActive}
          className={cn(
            styles.bottomTabAction,
            isMoreActive ? styles.bottomTabActive : styles.bottomTabInactive
          )}
        >
          <span className={cn(styles.tabPillWrap, isMoreActive && styles.tabPillActive)}>
            <MoreHorizontalIcon className={isMoreActive ? styles.tabIconBold : styles.icon20} aria-hidden />
          </span>
          <span className={isMoreActive ? styles.tabTextActive : styles.tabTextLabel}>More</span>
        </button>
      </li>
    </ul>
  )
}

function AdminBottomTabsWithPath(props: { ordersBadge?: ReactNode; onOpenMore: () => void }) {
  return <AdminBottomTabs {...props} pathname={usePathname()} />
}

/** Mobile & tablet app-like bottom navigation bar for Admin. */
export function AdminMobileBottomNav({ ordersBadge }: { ordersBadge?: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <>
      <nav

        data-admin-bottom-bar
        aria-label="Admin mobile navigation"
        className={styles.mobileBottomNav}
      >
        <Suspense fallback={<AdminBottomTabs pathname={null} ordersBadge={null} onOpenMore={() => setMoreOpen(true)} />}>
          <AdminBottomTabsWithPath ordersBadge={ordersBadge} onOpenMore={() => setMoreOpen(true)} />
        </Suspense>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className={styles.mobileDrawerSheet}>
          <SheetHeader className={styles.srOnly}>
            <SheetTitle>Admin menu</SheetTitle>
          </SheetHeader>
          <SidebarBody
            onNavigate={() => setMoreOpen(false)}
            onOpenCommand={() => {
              setMoreOpen(false)
              openAdminGlobalSearch()
            }}
            ordersBadge={ordersBadge}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}

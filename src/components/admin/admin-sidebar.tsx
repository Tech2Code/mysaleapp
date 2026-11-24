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
import { Suspense, useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Logo, LogoMark } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOutAdmin } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

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

const COMMAND_ITEMS: { label: string; hint: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard overview", hint: "Metrics, queue & sales", href: "/admin", icon: LayoutDashboardIcon },
  { label: "All orders", hint: "Manage & fulfil orders", href: "/admin/orders", icon: ShoppingCartIcon },
  { label: "Payments to verify", hint: "Pending UTR review", href: "/admin/orders?view=to-verify", icon: ShoppingCartIcon },
  { label: "To pack & ship", hint: "Confirmed orders ready to ship", href: "/admin/orders?view=to-ship", icon: ShoppingCartIcon },
  { label: "Return requests", hint: "Pending customer returns", href: "/admin/orders?view=return-requests", icon: ShoppingCartIcon },
  { label: "Products catalogue", hint: "Inventory, pricing & visibility", href: "/admin/products", icon: PackageIcon },
  { label: "Add new product", hint: "Create a product listing", href: "/admin/products/new", icon: PlusIcon },
  { label: "Categories", hint: "Organise collections", href: "/admin/categories", icon: TagsIcon },
  { label: "Store settings", hint: "Promo codes, UPI & shipping", href: "/admin/settings", icon: SettingsIcon },
  { label: "My account", hint: "Profile, Quick PIN & password", href: "/admin/account", icon: UserRoundCogIcon },
  { label: "Data & launch", hint: "Readiness checklist & reset", href: "/admin/launch", icon: RocketIcon },
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

function QuickJumpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onOpenChange])

  const filtered = COMMAND_ITEMS.filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return item.label.toLowerCase().includes(q) || item.hint.toLowerCase().includes(q)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("")
        onOpenChange(next)
      }}
    >
      <DialogContent data-ui="admin/QuickJumpDialog/DialogContent" className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>Quick jump</DialogTitle>
        </DialogHeader>
        <div data-ui="admin/QuickJumpDialog/div-flex" className="flex items-center gap-2.5 border-b px-4 py-3">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input data-ui="admin/QuickJumpDialog/input-jump-to-orders-product"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to orders, products, settings…"
            autoFocus
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd data-ui="admin/QuickJumpDialog/kbd-hidden" className="hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">ESC</kbd>
        </div>
        <div data-ui="admin/QuickJumpDialog/div" className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p data-ui="admin/QuickJumpDialog/p" className="py-8 text-center text-xs text-muted-foreground">No matching admin destination.</p>
          ) : (
            <ul data-ui="admin/QuickJumpDialog/ul" className="space-y-0.5">
              {filtered.map((item) => {
                const Icon = item.icon
                return (
                  <li data-ui="admin/QuickJumpDialog/li" key={item.href}>
                    <button data-ui="admin/QuickJumpDialog/button-flex"
                      type="button"
                      onClick={() => {
                        onOpenChange(false)
                        setQuery("")
                        router.push(item.href)
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div data-ui="admin/QuickJumpDialog/div-2" className="min-w-0 flex-1">
                        <p data-ui="admin/QuickJumpDialog/p-2" className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        <p data-ui="admin/QuickJumpDialog/p-3" className="truncate text-xs text-muted-foreground">{item.hint}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

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
        <div data-ui="admin/NavItems/div" key={group.title} className="space-y-0.5">
          {!collapsed ? (
            <p data-ui="admin/NavItems/p" className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/75 uppercase">
              {group.title}
            </p>
          ) : (
            <div data-ui="admin/NavItems/div-2" className="mx-auto my-2 h-px w-6 bg-border" aria-hidden />
          )}
          {group.links.map((l) => {
            const active = pathname !== null && (l.exact ? pathname === l.href : pathname.startsWith(l.href))
            return (
              <Link
                data-ui="admin/NavItems/Link"
                key={l.href}
                href={l.href}
                onClick={onNavigate}
                title={collapsed ? l.label : undefined}
                aria-label={collapsed ? l.label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-9 items-center rounded-lg text-[13px] leading-none transition-colors",
                  collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                  active
                    ? "bg-muted font-semibold text-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                {active && !collapsed && (
                  <span data-ui="admin/NavItems/span-absolute" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-primary" aria-hidden />
                )}
                <l.icon
                  data-ui="admin/NavItems/l.icon"
                  className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                  aria-hidden
                />
                {!collapsed && <span data-ui="admin/NavItems/span" className="flex-1 truncate leading-normal">{l.label}</span>}
                {l.badge === "orders" && (
                  <span data-ui="admin/NavItems/span-2" className={cn(collapsed && "absolute -top-1 -right-1 scale-75")}>{ordersBadge}</span>
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
    <div data-ui="admin/TopbarBreadcrumb" className="hidden items-center gap-2 text-sm lg:flex">
      <span data-ui="admin/TopbarBreadcrumb/span" className="text-xs font-medium text-muted-foreground">{match.group}</span>
      <span data-ui="admin/TopbarBreadcrumb/span-2" className="text-muted-foreground/40" aria-hidden>/</span>
      <span data-ui="admin/TopbarBreadcrumb/span-3" className="text-[13px] font-semibold text-foreground">{match.label}</span>
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
    <div data-ui="admin/SidebarBody" className={cn("flex h-full flex-col gap-4 overflow-y-auto", collapsed ? "p-2.5" : "p-3.5")}>
      {/* Same height as the top bar, so the two divider lines meet. */}
      <div
        data-ui="admin/SidebarBody/div"
        className={cn(
          "flex h-(--admin-topbar-h) shrink-0 items-center border-b border-border/70",
          collapsed ? "-mx-2.5 -mt-2.5 justify-center px-2" : "-mx-3.5 -mt-3.5 justify-between gap-2 px-3.5 pr-12 lg:pr-3"
        )}
      >
        {collapsed ? (
          <Link data-ui="admin/SidebarBody/Link-admin-home" href="/admin" aria-label="Admin home" className="grid place-items-center">
            <LogoMark className="size-8" />
          </Link>
        ) : (
          <div data-ui="admin/SidebarBody/div-flex" className="flex min-w-0 items-center gap-2">
            <Logo href="/admin" className="min-w-0 [&>span:last-child]:truncate [&>span:last-child]:text-lg" />
          </div>
        )}
        {onToggleCollapse && !collapsed && (
          <button data-ui="admin/SidebarBody/button-collapse-sidebar"
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="hidden size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:grid"
          >
            <PanelLeftCloseIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {onToggleCollapse && collapsed && (
        <button data-ui="admin/SidebarBody/button-expand-sidebar"
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="mx-auto hidden size-8 place-items-center rounded-lg border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:grid"
        >
          <PanelLeftOpenIcon className="size-4" aria-hidden />
        </button>
      )}

      {onOpenCommand && (
        <button data-ui="admin/SidebarBody/button-quick-jump"
          type="button"
          onClick={onOpenCommand}
          title={collapsed ? "Quick jump (⌘K)" : undefined}
          aria-label="Quick jump"
          className={cn(
            "flex h-8.5 items-center rounded-lg border border-border/80 bg-muted/40 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed ? "justify-center px-0" : "justify-between gap-2 px-2.5"
          )}
        >
          <span data-ui="admin/SidebarBody/span-flex" className="flex items-center gap-2">
            <SearchIcon className="size-3.5 shrink-0" aria-hidden />
            {!collapsed && <span data-ui="admin/SidebarBody/span">Search…</span>}
          </span>
          {!collapsed && (
            <kbd data-ui="admin/SidebarBody/kbd-inline-flex" className="inline-flex items-center gap-0.5 rounded-sm border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              <CommandIcon className="size-2.5" aria-hidden />K
            </kbd>
          )}
        </button>
      )}

      <nav data-ui="admin/SidebarBody/nav-admin" aria-label="Admin" className="flex flex-col gap-4">
        <Suspense fallback={<NavItems pathname={null} ordersBadge={null} collapsed={collapsed} />}>
          <NavItemsWithPath onNavigate={onNavigate} ordersBadge={ordersBadge} collapsed={collapsed} />
        </Suspense>
      </nav>

      <div data-ui="admin/SidebarBody/div-2" className="mt-auto space-y-0.5 border-t border-border/70 pt-3">
        <Link
          data-ui="admin/SidebarBody/Link"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "View store" : undefined}
          aria-label={collapsed ? "View store" : undefined}
          className={cn(
            "flex h-9 items-center rounded-lg text-[13px] leading-none font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
          )}
        >
          <ExternalLinkIcon className="size-4 shrink-0" aria-hidden />
          {!collapsed && <span data-ui="admin/SidebarBody/span-2">View store</span>}
        </Link>
        <button
          data-ui="admin/SidebarBody/button"
          type="button"
          onClick={() => setAskSignOut(true)}
          title={collapsed ? "Sign out" : undefined}
          aria-label={collapsed ? "Sign out" : undefined}
          className={cn(
            "flex h-9 w-full items-center rounded-lg text-[13px] leading-none font-medium text-destructive transition-colors hover:bg-destructive/10",
            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"
          )}
        >
          <LogOutIcon className="size-4 shrink-0" aria-hidden />
          {!collapsed && <span data-ui="admin/SidebarBody/span-3">Sign out</span>}
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

/** Desktop sidebar with collapsible rail and quick jump command. */
export function AdminSidebar({ ordersBadge }: { ordersBadge?: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false)
  const collapsed = useSyncExternalStore(subscribeSidebarCollapsed, getSidebarCollapsedSnapshot, () => false)

  const toggleCollapse = () => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "0" : "1")
      window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
    } catch {}
  }

  return (
    <>
      <aside
        data-ui="admin/AdminSidebar/aside"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 overflow-y-auto border-r border-border/80 bg-card transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-60"
        )}
      >
        <SidebarBody
          ordersBadge={ordersBadge}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenCommand={() => setCommandOpen(true)}
        />
      </aside>
      <QuickJumpDialog open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  )
}

/** Top bar: menu button on phones/tablets, breadcrumb on desktop, quick add product, theme toggle and account menu. */
export function AdminTopbar({ ordersBadge, account }: { ordersBadge?: ReactNode; account?: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <header data-ui="admin/AdminTopbar" className="sticky top-0 z-30 flex h-(--admin-topbar-h) min-w-0 items-center gap-2 border-b border-border/80 bg-card/90 px-3 backdrop-blur-md sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          data-ui="admin/AdminTopbar/SheetTrigger-open-admin-menu"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "size-10 shrink-0 rounded-lg lg:hidden")}
          aria-label="Open admin menu"
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent data-ui="admin/AdminTopbar/SheetContent" side="left" className="w-68 bg-card p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin menu</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setOpen(false)} ordersBadge={ordersBadge} />
        </SheetContent>
      </Sheet>

      <div data-ui="admin/AdminTopbar/div" className="min-w-0 flex-1 lg:hidden">
        <Logo href="/admin" />
      </div>

      <Suspense fallback={null}>
        <TopbarBreadcrumb />
      </Suspense>

      <div data-ui="admin/AdminTopbar/div-flex" className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <Link data-ui="admin/AdminTopbar/Link-new-product"
          href="/admin/products/new"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden h-8 rounded-lg px-2.5 text-xs font-medium md:inline-flex")}
        >
          <PlusIcon className="size-3.5" aria-hidden /> New product
        </Link>
        <ThemeToggle className="hidden sm:inline-flex" />
        {account}
      </div>
    </header>
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
    <ul data-ui="admin/AdminBottomTabs" className="grid h-15.5 grid-cols-5 items-center px-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <li data-ui="admin/AdminBottomTabs/li-flex" key={tab.key} className="flex justify-center">
            <Link
              data-ui="admin/AdminBottomTabs/Link"
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95",
                tab.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span data-ui="admin/AdminBottomTabs/span" className={cn("relative grid h-7.5 w-12 place-items-center rounded-full", tab.active && "bg-primary/14 ring-1 ring-primary/20")}>
                <Icon className={cn("size-5", tab.active && "stroke-[2.25]")} aria-hidden />
                {tab.badge && (
                  <span data-ui="admin/AdminBottomTabs/span-absolute" className="pointer-events-none absolute -top-1 -right-1 scale-75">{tab.badge}</span>
                )}
              </span>
              <span data-ui="admin/AdminBottomTabs/span-2" className={cn("text-[0.68rem]/tight font-medium tracking-tight", tab.active ? "font-semibold text-primary" : "text-muted-foreground")}>
                {tab.label}
              </span>
            </Link>
          </li>
        )
      })}
      <li data-ui="admin/AdminBottomTabs/li-flex-2" className="flex justify-center">
        <button
          data-ui="admin/AdminBottomTabs/button"
          type="button"
          onClick={onOpenMore}
          aria-pressed={isMoreActive}
          className={cn(
            "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95",
            isMoreActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span data-ui="admin/AdminBottomTabs/span-3" className={cn("grid h-7.5 w-12 place-items-center rounded-full", isMoreActive && "bg-primary/14 ring-1 ring-primary/20")}>
            <MoreHorizontalIcon className={cn("size-5", isMoreActive && "stroke-[2.25]")} aria-hidden />
          </span>
          <span data-ui="admin/AdminBottomTabs/span-4" className={cn("text-[0.68rem]/tight font-medium tracking-tight", isMoreActive ? "font-semibold text-primary" : "text-muted-foreground")}>More</span>
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
        data-ui="admin/AdminMobileBottomNav/nav-admin-mobile-navigatio"
        data-admin-bottom-bar
        aria-label="Admin mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_28px_-10px_rgb(0_0_0/0.14)] backdrop-blur-xl lg:hidden"
      >
        <Suspense fallback={<AdminBottomTabs pathname={null} ordersBadge={null} onOpenMore={() => setMoreOpen(true)} />}>
          <AdminBottomTabsWithPath ordersBadge={ordersBadge} onOpenMore={() => setMoreOpen(true)} />
        </Suspense>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent data-ui="admin/AdminMobileBottomNav/SheetContent" side="left" className="w-68 bg-card p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin menu</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setMoreOpen(false)} ordersBadge={ordersBadge} />
        </SheetContent>
      </Sheet>
    </>
  )
}

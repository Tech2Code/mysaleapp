"use client"

import {
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  MoreHorizontalIcon,
  PackageIcon,
  RocketIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagsIcon,
  UserRoundCogIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Suspense, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOutAdmin } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type NavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: "orders" }

const GROUPS: { title: string; links: NavLink[] }[] = [
  { title: "Overview", links: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, exact: true }] },
  {
    title: "Sales",
    links: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon, badge: "orders" },
      { href: "/admin/products", label: "Products", icon: PackageIcon },
      { href: "/admin/categories", label: "Categories", icon: TagsIcon },
    ],
  },
  {
    title: "Store",
    links: [
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
      { href: "/admin/account", label: "My account", icon: UserRoundCogIcon },
      { href: "/admin/launch", label: "Data & launch", icon: RocketIcon },
    ],
  },
]

function NavItems({
  pathname,
  onNavigate,
  ordersBadge,
}: {
  pathname: string | null
  onNavigate?: () => void
  ordersBadge?: ReactNode
}) {
  return (
    <>
      {GROUPS.map((group) => (
        <div data-ui="admin/NavItems/div" key={group.title} className="space-y-1">
          <p data-ui="admin/NavItems/p" className="px-3 pb-1 text-[0.68rem] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{group.title}</p>
          {group.links.map((l) => {
            const active = pathname !== null && (l.exact ? pathname === l.href : pathname.startsWith(l.href))
            return (
              <Link data-ui="admin/NavItems/Link"
                key={l.href}
                href={l.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-xl px-3 text-sm leading-none font-medium transition-all",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/25"
                    : "text-sidebar-foreground/75 hover:translate-x-0.5 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <l.icon data-ui="admin/NavItems/l.icon" className="size-4 shrink-0" aria-hidden />
                <span data-ui="admin/NavItems/span" className="flex-1 truncate leading-normal">{l.label}</span>
                {l.badge === "orders" && ordersBadge}
              </Link>
            )
          })}
        </div>
      ))}
    </>
  )
}

function NavItemsWithPath(props: { onNavigate?: () => void; ordersBadge?: ReactNode }) {
  return <NavItems {...props} pathname={usePathname()} />
}

function SidebarBody({ onNavigate, ordersBadge }: { onNavigate?: () => void; ordersBadge?: ReactNode }) {
  const router = useRouter()
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  useBlockWhile(signingOut)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(signingOut)
  return (
    <div data-ui="admin/SidebarBody" className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {/* Same height as the top bar, so the two divider lines meet. */}
      <div data-ui="admin/SidebarBody/div-flex" className="-mx-4 -mt-4 flex h-(--admin-topbar-h) shrink-0 items-center border-b border-sidebar-border px-5 pr-12 lg:pr-5">
        <Logo href="/admin" className="min-w-0 [&>span:last-child]:truncate" />
      </div>
      <nav data-ui="admin/SidebarBody/nav-admin" aria-label="Admin" className="flex flex-col gap-5">
        <Suspense fallback={<NavItems pathname={null} ordersBadge={null} />}>
          <NavItemsWithPath onNavigate={onNavigate} ordersBadge={ordersBadge} />
        </Suspense>
      </nav>
      <div data-ui="admin/SidebarBody/div" className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
        <Link data-ui="admin/SidebarBody/Link-view-store"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm leading-none font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent"
        >
          <ExternalLinkIcon className="size-4" aria-hidden /> View store
        </Link>
        <button data-ui="admin/SidebarBody/button-sign-out"
          type="button"
          onClick={() => setAskSignOut(true)}
          className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm leading-none font-medium text-destructive transition-colors hover:bg-destructive/10"
        >
          <LogOutIcon className="size-4" aria-hidden /> Sign out
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

/** Desktop sidebar. */
export function AdminSidebar({ ordersBadge }: { ordersBadge?: ReactNode }) {
  return (
    <aside data-ui="admin/AdminSidebar" className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto border-r bg-sidebar lg:block">
      <SidebarBody ordersBadge={ordersBadge} />
    </aside>
  )
}

/** Top bar: menu button on phones/tablets, theme toggle and a shortcut to the store everywhere. */
export function AdminTopbar({ ordersBadge, account }: { ordersBadge?: ReactNode; account?: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div data-ui="admin/AdminTopbar" className="sticky top-0 z-30 flex h-(--admin-topbar-h) min-w-0 items-center gap-2 border-b glass px-3 sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger data-ui="admin/AdminTopbar/SheetTrigger-open-admin-menu"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0 rounded-full lg:hidden")}
          aria-label="Open admin menu"
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent data-ui="admin/AdminTopbar/SheetContent" side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin menu</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setOpen(false)} ordersBadge={ordersBadge} />
        </SheetContent>
      </Sheet>
      <div data-ui="admin/AdminTopbar/div" className="min-w-0 flex-1 lg:hidden">
        <Logo href="/admin" />
      </div>
      <div data-ui="admin/AdminTopbar/div-flex" className="ml-auto flex shrink-0 items-center gap-1.5">
        <Link data-ui="admin/AdminTopbar/Link-view-store"
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden rounded-full sm:inline-flex")}
        >
          <ExternalLinkIcon /> View store
        </Link>
        <ThemeToggle className="hidden sm:inline-flex" />
        {account}
      </div>
    </div>
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
            <Link data-ui="admin/AdminBottomTabs/Link"
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
        <button data-ui="admin/AdminBottomTabs/button"
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-6px_28px_-10px_rgb(0_0_0/0.14)] backdrop-blur-xl lg:hidden"
      >
        <Suspense fallback={<AdminBottomTabs pathname={null} ordersBadge={null} onOpenMore={() => setMoreOpen(true)} />}>
          <AdminBottomTabsWithPath ordersBadge={ordersBadge} onOpenMore={() => setMoreOpen(true)} />
        </Suspense>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent data-ui="admin/AdminMobileBottomNav/SheetContent" side="left" className="w-72 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin menu</SheetTitle>
          </SheetHeader>
          <SidebarBody onNavigate={() => setMoreOpen(false)} ordersBadge={ordersBadge} />
        </SheetContent>
      </Sheet>
    </>
  )
}

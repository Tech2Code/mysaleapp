"use client"

import {
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  RocketIcon,
  SettingsIcon,
  ShoppingCartIcon,
  TagsIcon,
  UserRoundCogIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useState, type ReactNode } from "react"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOutAdmin } from "@/features/auth/actions"
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
                <span data-ui="admin/NavItems/span" className="flex-1 truncate">{l.label}</span>
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
  return (
    <div data-ui="admin/SidebarBody" className="flex h-full flex-col gap-6 p-4">
      <div data-ui="admin/SidebarBody/div" className="px-1 pt-1">
        <Logo href="/admin" />
        <p data-ui="admin/SidebarBody/p" className="mt-1 pl-12.4 text-xs text-sidebar-foreground/50">Admin panel</p>
      </div>
      <nav data-ui="admin/SidebarBody/nav-admin" aria-label="Admin" className="flex flex-col gap-5">
        <Suspense fallback={<NavItems pathname={null} ordersBadge={null} />}>
          <NavItemsWithPath onNavigate={onNavigate} ordersBadge={ordersBadge} />
        </Suspense>
      </nav>
      <div data-ui="admin/SidebarBody/div-2" className="mt-auto space-y-1 border-t border-sidebar-border pt-4">
        <Link data-ui="admin/SidebarBody/Link-view-store"
          href="/"
          target="_blank"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm leading-none font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent"
        >
          <ExternalLinkIcon className="size-4" aria-hidden /> View store
        </Link>
        <form data-ui="admin/SidebarBody/form" action={signOutAdmin}>
          <button data-ui="admin/SidebarBody/button-sign-out"
            type="submit"
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm leading-none font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOutIcon className="size-4" aria-hidden /> Sign out
          </button>
        </form>
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
    <div data-ui="admin/AdminTopbar" className="sticky top-0 z-30 flex h-(--admin-topbar-h) items-center gap-2 border-b glass px-3 sm:px-6 lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger data-ui="admin/AdminTopbar/SheetTrigger-open-admin-menu"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full lg:hidden")}
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
      <div data-ui="admin/AdminTopbar/div" className="lg:hidden">
        <Logo href="/admin" />
      </div>
      <div data-ui="admin/AdminTopbar/div-flex" className="ml-auto flex items-center gap-1.5">
        <Link data-ui="admin/AdminTopbar/Link-view-store"
          href="/"
          target="_blank"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden rounded-full sm:inline-flex")}
        >
          <ExternalLinkIcon /> View store
        </Link>
        <ThemeToggle />
        {account}
      </div>
    </div>
  )
}

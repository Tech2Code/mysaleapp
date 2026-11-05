"use client"

import {
  ExternalLinkIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  ShoppingCartIcon,
  TagsIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { signOutAdmin } from "@/features/auth/actions"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCartIcon },
  { href: "/admin/products", label: "Products", icon: PackageIcon },
  { href: "/admin/categories", label: "Categories", icon: TagsIcon },
]

function NavItems({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      {links.map((l) => {
        const active =
          pathname !== null && (l.exact ? pathname === l.href : pathname.startsWith(l.href))
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/20"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <l.icon className="size-4" /> {l.label}
          </Link>
        )
      })}
    </>
  )
}

function NavItemsWithPath(props: { onNavigate?: () => void }) {
  return <NavItems {...props} pathname={usePathname()} />
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo href="/admin" />
      <nav aria-label="Admin" className="flex flex-col gap-1">
        <Suspense fallback={<NavItems pathname={null} />}>
          <NavItemsWithPath onNavigate={onNavigate} />
        </Suspense>
      </nav>
      <div className="mt-auto space-y-1 border-t pt-4">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent"
        >
          <ExternalLinkIcon className="size-4" /> View store
        </Link>
        <form action={signOutAdmin}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            <LogOutIcon className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </div>
  )
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarBody />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b glass px-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full")}
            aria-label="Open admin menu"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Admin menu</SheetTitle>
            </SheetHeader>
            <SidebarBody onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <Logo href="/admin" />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </>
  )
}

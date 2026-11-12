"use client"

import { PackageIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/account/orders", label: "My orders", icon: PackageIcon },
  { href: "/account/profile", label: "Profile & address", icon: UserIcon },
]

function NavItems({ pathname }: { pathname: string | null }) {
  return (
    <>
      {links.map((l) => {
        const active = pathname?.startsWith(l.href) ?? false
        return (
          <Link data-ui="account/NavItems/Link"
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card hover:bg-muted lg:bg-transparent"
            )}
          >
            <l.icon data-ui="account/NavItems/l.icon" className="size-4" /> {l.label}
          </Link>
        )
      })}
    </>
  )
}

function NavItemsWithPath() {
  return <NavItems pathname={usePathname()} />
}

export function AccountNav() {
  return (
    <nav data-ui="account/AccountNav" aria-label="Account" className="scroll-row flex gap-2 lg:flex-col">
      <Suspense fallback={<NavItems pathname={null} />}>
        <NavItemsWithPath />
      </Suspense>
    </nav>
  )
}

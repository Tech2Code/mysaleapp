"use client"

import { HeartIcon, HomeIcon, LayoutGridIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react"
import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { Suspense } from "react"
import { ScrollLink } from "@/components/shared/scroll-link"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { cartCount, useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      data-ui="store/TabBadge"
      className="absolute -top-1 -right-2 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[0.625rem]/4.5 font-bold text-primary-foreground ring-2 ring-background"
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

function BottomNavTabs({ pathname }: { pathname: string | null }) {
  const mounted = useMounted()
  const { user } = useAuth()
  const itemCount = useCart((s) => cartCount(s.items))
  const isCartOpen = useCart((s) => s.isOpen)
  const openCart = useCart((s) => s.setOpen)
  const wishCount = useWishlist((s) => s.ids.length)

  // On product detail pages with the sticky buy bar, keep the bottom nav tucked away so the buy CTA owns the bottom edge.
  const isProductDetail = pathname !== null && /^\/products\/[^/]+$/.test(pathname)
  const isCheckout = pathname === "/checkout"
  if (isProductDetail || isCheckout) return null

  const isHome = pathname === "/"
  const isShop = pathname !== null && (pathname === "/products" || pathname.startsWith("/category/"))
  const isWishlist = pathname === "/wishlist"
  const isAccount =
    pathname !== null && (pathname.startsWith("/account") || pathname === "/login" || pathname === "/track")
  const accountHref = user ? "/account/orders" : "/login"

  const tabs = [
    { key: "home", href: "/", label: "Home", icon: HomeIcon, active: isHome && !isCartOpen },
    { key: "shop", href: "/products", label: "Shop", icon: LayoutGridIcon, active: isShop && !isCartOpen },
    {
      key: "wishlist",
      href: "/wishlist",
      label: "Wishlist",
      icon: HeartIcon,
      active: isWishlist && !isCartOpen,
      badge: mounted ? wishCount : 0,
    },
    {
      key: "cart",
      onClick: () => openCart(true),
      label: "Cart",
      icon: ShoppingBagIcon,
      active: isCartOpen,
      badge: mounted ? itemCount : 0,
    },
    {
      key: "account",
      href: accountHref,
      label: user ? "Account" : "Sign in",
      icon: UserRoundIcon,
      active: isAccount && !isCartOpen,
    },
  ]

  return (
    <nav
      data-ui="store/BottomNavTabs"
      data-mobile-bottom-bar
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12)] backdrop-blur-xl sm:hidden"
    >
      <ul data-ui="store/BottomNavTabs/ul-grid" className="grid h-15 grid-cols-5 items-center px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const content = (
            <>
              <span data-ui="store/BottomNavTabs/span-grid" className="relative grid h-7 w-12 place-items-center rounded-full">
                {tab.active && (
                  <m.span
                    data-ui="store/BottomNavTabs/m.span-absolute"
                    layoutId="mobile-bottom-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary/15"
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span data-ui="store/BottomNavTabs/span-relative" className="relative">
                  <Icon className={cn("size-5 transition-transform duration-150", tab.active && "scale-105 stroke-[2.25]")} />
                  {tab.badge ? <TabBadge count={tab.badge} /> : null}
                </span>
              </span>
              <span
                data-ui="store/BottomNavTabs/span"
                className={cn(
                  "text-[0.68rem]/tight font-medium tracking-tight",
                  tab.active ? "font-semibold text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
            </>
          )

          return (
            <li data-ui="store/BottomNavTabs/li-flex" key={tab.key} className="flex justify-center">
              {"href" in tab && tab.href ? (
                <ScrollLink
                  data-ui="store/BottomNavTabs/ScrollLink"
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95",
                    tab.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {content}
                </ScrollLink>
              ) : (
                <button
                  data-ui="store/BottomNavTabs/button"
                  type="button"
                  onClick={tab.onClick}
                  className={cn(
                    "flex w-full flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95",
                    tab.active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {content}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function BottomNavWithPath() {
  return <BottomNavTabs pathname={usePathname()} />
}

export function MobileBottomNav() {
  return (
    <Suspense fallback={<BottomNavTabs pathname={null} />}>
      <BottomNavWithPath />
    </Suspense>
  )
}


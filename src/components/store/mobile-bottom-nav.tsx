"use client"

import { HeartIcon, HomeIcon, LayoutGridIcon, ShoppingBagIcon, UserRoundIcon } from "lucide-react"
import * as m from "motion/react-m"
import { usePathname } from "next/navigation"
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ScrollLink } from "@/components/shared/scroll-link"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"
import { cartCount, useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"
import styles from "./mobile-bottom-nav.module.css"

function TabBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span

      className={styles.tabBadge}
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
  const [cartBump, setCartBump] = useState(false)
  const [wishlistBump, setWishlistBump] = useState(false)
  const bumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wishBumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const onCartLanded = () => {
      setCartBump(true)
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current)
      bumpTimerRef.current = setTimeout(() => setCartBump(false), 420)
    }
    const onWishlistLanded = () => {
      setWishlistBump(true)
      if (wishBumpTimerRef.current) clearTimeout(wishBumpTimerRef.current)
      wishBumpTimerRef.current = setTimeout(() => setWishlistBump(false), 420)
    }
    window.addEventListener("kk-cart-arc-landed", onCartLanded)
    window.addEventListener("kk-wishlist-arc-landed", onWishlistLanded)
    return () => {
      window.removeEventListener("kk-cart-arc-landed", onCartLanded)
      window.removeEventListener("kk-wishlist-arc-landed", onWishlistLanded)
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current)
      if (wishBumpTimerRef.current) clearTimeout(wishBumpTimerRef.current)
    }
  }, [])

  // On product detail and checkout pages with their own sticky bottom CTA, keep the bottom nav tucked away.
  const isProductDetail = pathname !== null && /^\/products\/[^/]+$/.test(pathname)
  const isCheckout = pathname === "/checkout"

  if (isProductDetail || isCheckout) return null

  const isHome = pathname === "/"
  const isShop = pathname !== null && (pathname === "/products" || pathname.startsWith("/category/"))
  const isWishlist = pathname === "/wishlist"
  const isAccount =
    pathname !== null && (pathname.startsWith("/account") || pathname === "/login" || pathname === "/track")
  const showSignIn = !user && !pathname?.startsWith("/account")
  const loginHref =
    pathname && pathname !== "/" && pathname !== "/login" && !pathname.startsWith("/login/")
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login"
  const accountHref = showSignIn ? loginHref : "/account/orders"

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
      label: showSignIn ? "Sign in" : "Account",
      icon: UserRoundIcon,
      active: isAccount && !isCartOpen,
    },
  ]

  return (
    <nav

      data-mobile-bottom-bar
      aria-label="Mobile navigation"
      className={cn(styles.bottomNav, "glass")}
    >
      <ul className={styles.tabList}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const content = (
            <>
              <span className={styles.iconPill}>
                {tab.active && (
                  <m.span

                    layoutId="mobile-bottom-nav-pill"
                    className={styles.activePill}
                    transition={{ type: "spring", stiffness: 450, damping: 32 }}
                  />
                )}
                <span className={styles.iconWrap}>
                  <Icon className={cn(styles.tabIcon, tab.active && styles.tabIconActive)} aria-hidden />
                  {tab.badge ? <TabBadge count={tab.badge} /> : null}
                </span>
              </span>
              <span

                className={cn(styles.tabLabel, tab.active && styles.tabLabelActive)}
              >
                {tab.label}
              </span>
            </>
          )

          return (
            <li key={tab.key} className={styles.tabItem}>
              {"href" in tab && tab.href ? (
                <ScrollLink

                  href={tab.href}
                  data-wishlist-target={tab.key === "wishlist" ? "true" : undefined}
                  aria-current={tab.active ? "page" : undefined}
                  className={cn(styles.tabInteractive, tab.active && styles.tabInteractiveActive, tab.key === "wishlist" && wishlistBump && styles.cartBumpActive)}
                >
                  {content}
                </ScrollLink>
              ) : (
                <button

                  type="button"
                  data-cart-target={tab.key === "cart" ? "true" : undefined}
                  onClick={tab.onClick}
                  aria-pressed={tab.active}
                  className={cn(styles.tabInteractive, tab.active && styles.tabInteractiveActive, tab.key === "cart" && cartBump && styles.cartBumpActive)}
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
  const pathname = usePathname()
  const isCheckout = pathname === "/checkout"
  const isProductDetail = /^\/products\/[^/]+$/.test(pathname) || isCheckout

  useLayoutEffect(() => {
    if (isProductDetail) {
      document.body.setAttribute("data-product-detail", "true")
    } else {
      document.body.removeAttribute("data-product-detail")
    }
    if (isCheckout) {
      document.body.setAttribute("data-checkout-fullscreen", "true")
    } else {
      document.body.removeAttribute("data-checkout-fullscreen")
    }
    return () => {
      document.body.removeAttribute("data-product-detail")
      document.body.removeAttribute("data-checkout-fullscreen")
    }
  }, [isProductDetail, isCheckout])

  return <BottomNavTabs pathname={pathname} />
}

export function MobileBottomNav() {
  return (
    <Suspense fallback={<BottomNavTabs pathname={null} />}>
      <BottomNavWithPath />
    </Suspense>
  )
}


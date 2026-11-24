"use client"

import { HeartIcon, MenuIcon, SearchIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, useMotionValueEvent, useScroll } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { ScrollLink } from "@/components/shared/scroll-link"
import { usePathname } from "next/navigation"
import { Suspense, useState } from "react"
import { Logo } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useMounted } from "@/hooks/use-mounted"
import { cn } from "@/lib/utils"
import { cartCount, useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"
import { AccountMenu } from "./account-menu"
import styles from "./header.module.css"
import { SearchDialog } from "./search-dialog"

export type NavCategory = { name: string; slug: string }
type NavLinkItem = { href: string; label: string }

const isActive = (pathname: string | null, href: string) =>
  pathname !== null && (pathname === href || pathname.startsWith(`${href}/`))

function CountBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <m.span
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 20 }}
          className={styles.countBadge}
        >
          {count > 99 ? "99+" : count}
        </m.span>
      )}
    </AnimatePresence>
  )
}

function DesktopNavItems({ links, pathname }: { links: NavLinkItem[]; pathname: string | null }) {
  return (
    <>
      {links.map((l) => {
        const active = isActive(pathname, l.href)
        return (
          <ScrollLink
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(styles.desktopNavLink, active && styles.desktopNavLinkActive)}
          >
            {l.label}
            {active && (
              <m.span
                layoutId="nav-pill"
                className={styles.activeNavBeam}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
          </ScrollLink>
        )
      })}
    </>
  )
}

/** Reads the URL, so it lives inside <Suspense> (required by Cache Components). */
function DesktopNavWithPath({ links }: { links: NavLinkItem[] }) {
  return <DesktopNavItems links={links} pathname={usePathname()} />
}

function MobileNavItems({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLinkItem[]
  pathname: string | null
  onNavigate: () => void
}) {
  return (
    <>
      {links.map((l, i) => (
        <m.div key={l.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
          <ScrollLink
            href={l.href}
            onClick={onNavigate}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(styles.mobileNavLink, isActive(pathname, l.href) && styles.mobileNavLinkActive)}
          >
            {l.label}
          </ScrollLink>
        </m.div>
      ))}
    </>
  )
}

function MobileNavWithPath(props: { links: NavLinkItem[]; onNavigate: () => void }) {
  return <MobileNavItems {...props} pathname={usePathname()} />
}

function MobileHeaderShortcuts({
  mounted,
  wishCount,
  itemCount,
  onOpenCart,
}: {
  mounted: boolean
  wishCount: number
  itemCount: number
  onOpenCart: () => void
}) {
  const pathname = usePathname()
  const isDetailOrCheckout =
    pathname !== null && (/^\/products\/[^/]+$/.test(pathname) || pathname === "/checkout")
  if (!isDetailOrCheckout) return null

  return (
    <div className={styles.mobileShortcuts}>
      <Link

        href="/wishlist"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.shortcutBtn)}
        aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} ${wishCount === 1 ? "item" : "items"}` : ""}`}
      >
        <HeartIcon className={styles.actionIcon} />
        {mounted && <CountBadge count={wishCount} />}
      </Link>
      <button

        type="button"
        onClick={onOpenCart}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.shortcutBtn)}
        aria-label={`Open cart${mounted ? `, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : ""}`}
      >
        <ShoppingBagIcon className={styles.actionIcon} />
        {mounted && <CountBadge count={itemCount} />}
      </button>
    </div>
  )
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const mounted = useMounted()
  const itemCount = useCart((s) => cartCount(s.items))
  const openCart = useCart((s) => s.setOpen)
  const wishCount = useWishlist((s) => s.ids.length)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12))

  const links: NavLinkItem[] = [
    { href: "/products", label: "Shop all" },
    ...categories.slice(0, 4).map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
    { href: "/track", label: "Track order" },
  ]
  const mobileLinks = [...links, { href: "/about", label: "About us" }]
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
    <header
      className={cn(styles.storeHeader, scrolled && styles.headerScrolled)}
    >
      <div className={styles.headerContainer}>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.mobileMenuTrigger)}
            aria-label="Open menu"
          >
            <MenuIcon className={styles.menuTriggerIcon} />
          </SheetTrigger>
          <SheetContent side="left" className={styles.mobileSheetContent}>
            <SheetHeader className={styles.mobileSheetHeader}>
              <SheetTitle className={styles.srOnlyTitle}>Menu</SheetTitle>
              <Logo />
            </SheetHeader>
            <nav className={styles.mobileNavList} aria-label="Mobile">
              <Suspense fallback={<MobileNavItems links={mobileLinks} pathname={null} onNavigate={closeMobile} />}>
                <MobileNavWithPath links={mobileLinks} onNavigate={closeMobile} />
              </Suspense>
            </nav>
          </SheetContent>
        </Sheet>

        <Logo className={styles.brandLogo} />

        <nav className={styles.desktopNav} aria-label="Main">
          <Suspense fallback={<DesktopNavItems links={links} pathname={null} />}>
            <DesktopNavWithPath links={links} />
          </Suspense>
        </nav>

        <div className={styles.headerActions}>
          <button
            data-search-trigger=""
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.searchTriggerBtn)}
            aria-label="Search products"
            aria-expanded={searchOpen}
          >
            <SearchIcon className={styles.searchIcon} />
            <span className={styles.searchLabel}>Search…</span>
          </button>
          <ThemeToggle className={styles.desktopThemeToggle} />
          <Suspense fallback={null}>
            <MobileHeaderShortcuts
              mounted={mounted}
              wishCount={wishCount}
              itemCount={itemCount}
              onOpenCart={() => openCart(true)}
            />
          </Suspense>
          <Link
            href="/wishlist"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.desktopActionBtn)}
            aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} ${wishCount === 1 ? "item" : "items"}` : ""}`}
          >
            <HeartIcon className={styles.actionIcon} />
            {mounted && <CountBadge count={wishCount} />}
          </Link>
          <button
            type="button"
            onClick={() => openCart(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.desktopActionBtn)}
            aria-label={`Open cart${mounted ? `, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : ""}`}
          >
            <ShoppingBagIcon className={styles.actionIcon} />
            {mounted && <CountBadge count={itemCount} />}
          </button>
          <span className={styles.accountMenuWrap}><AccountMenu /></span>
        </div>
      </div>
    </header>
    <Suspense fallback={null}>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} categories={categories} />
    </Suspense>
    </>
  )
}

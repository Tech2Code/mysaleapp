"use client"

import { ArrowRightIcon, ChevronDownIcon, HeartIcon, MenuIcon, SearchIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, useMotionValueEvent, useScroll } from "motion/react"
import * as m from "motion/react-m"
import Link from "next/link"
import { ScrollLink } from "@/components/shared/scroll-link"
import { usePathname } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
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

export type NavCategory = { name: string; slug: string; count?: number }
type NavLinkItem = { href: string; label: string }

const PRIMARY_NAV_LINKS: NavLinkItem[] = [
  { href: "/products", label: "Shop all" },
  { href: "/about", label: "Our story" },
  { href: "/track", label: "Track order" },
  { href: "/faq", label: "FAQs" },
  { href: "/contact", label: "Contact us" },
]

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

function DesktopCollectionsDropdown({
  categories,
  pathname,
}: {
  categories: NavCategory[]
  pathname: string | null
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const isCollectionActive = pathname !== null && pathname.startsWith("/category/")

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (categories.length === 0) return null

  return (
    <div
      ref={wrapRef}
      className={styles.collectionsMenuWrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(styles.desktopNavLink, isCollectionActive && styles.desktopNavLinkActive)}
      >
        <span>Collections</span>
        <ChevronDownIcon className={cn(styles.collectionsChevron, open && styles.collectionsChevronOpen)} aria-hidden />
        {isCollectionActive && (
          <m.span
            layoutId="nav-pill"
            className={styles.activeNavBeam}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.2, 0, 0, 1] }}
            className={styles.collectionsDropdownBridge}
          >
            <div role="menu" aria-label="Product collections" className={styles.collectionsPopoverCard}>
              <div className={styles.collectionsPopoverHeader}>
                <p className={styles.collectionsEyebrow}>Browse categories</p>
              </div>
              <ul className={styles.collectionsGridList}>
                {categories.map((cat) => {
                  const href = `/category/${cat.slug}`
                  const active = isActive(pathname, href)
                  return (
                    <li key={cat.slug} role="none">
                      <ScrollLink
                        role="menuitem"
                        href={href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(styles.collectionMenuItem, active && styles.collectionMenuItemActive)}
                      >
                        <span>{cat.name}</span>
                        {typeof cat.count === "number" && (
                          <span className={styles.collectionCountBadge}>{cat.count}</span>
                        )}
                      </ScrollLink>
                    </li>
                  )
                })}
              </ul>
              <ScrollLink
                href="/products"
                onClick={() => setOpen(false)}
                className={styles.collectionsFooterLink}
              >
                <span>Explore all products</span>
                <ArrowRightIcon className={styles.collectionsArrowIcon} aria-hidden />
              </ScrollLink>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DesktopNavItems({
  links,
  categories,
  pathname,
}: {
  links: NavLinkItem[]
  categories: NavCategory[]
  pathname: string | null
}) {
  const [firstLink, ...restLinks] = links
  const renderLink = (l: NavLinkItem) => {
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
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
          />
        )}
      </ScrollLink>
    )
  }

  return (
    <>
      {firstLink && renderLink(firstLink)}
      <DesktopCollectionsDropdown categories={categories} pathname={pathname} />
      {restLinks.map(renderLink)}
    </>
  )
}

/** Reads the URL, so it lives inside <Suspense> (required by Cache Components). */
function DesktopNavWithPath({ links, categories }: { links: NavLinkItem[]; categories: NavCategory[] }) {
  return <DesktopNavItems links={links} categories={categories} pathname={usePathname()} />
}

function MobileNavItems({
  links,
  categories,
  pathname,
  onNavigate,
}: {
  links: NavLinkItem[]
  categories: NavCategory[]
  pathname: string | null
  onNavigate: () => void
}) {
  return (
    <>
      {links.map((l, i) => (
        <m.div key={l.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
          <ScrollLink
            href={l.href}
            onClick={onNavigate}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(styles.mobileNavLink, isActive(pathname, l.href) && styles.mobileNavLinkActive)}
          >
            <span>{l.label}</span>
          </ScrollLink>
        </m.div>
      ))}
      {categories.length > 0 && (
        <>
          <p className={styles.mobileNavSectionLabel}>Collections</p>
          {categories.map((c, i) => {
            const href = `/category/${c.slug}`
            const active = isActive(pathname, href)
            return (
              <m.div
                key={href}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * (links.length + i) }}
              >
                <ScrollLink
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(styles.mobileNavLink, active && styles.mobileNavLinkActive)}
                >
                  <span>{c.name}</span>
                  {typeof c.count === "number" && (
                    <span className={styles.mobileCountPill}>{c.count}</span>
                  )}
                </ScrollLink>
              </m.div>
            )
          })}
        </>
      )}
    </>
  )
}

function MobileNavWithPath(props: { links: NavLinkItem[]; categories: NavCategory[]; onNavigate: () => void }) {
  return <MobileNavItems {...props} pathname={usePathname()} />
}

function MobileHeaderShortcuts({
  mounted,
  wishCount,
  itemCount,
  cartBump,
  wishlistBump,
  onOpenCart,
}: {
  mounted: boolean
  wishCount: number
  itemCount: number
  cartBump: boolean
  wishlistBump: boolean
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
        data-wishlist-target="true"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.shortcutBtn, wishlistBump && styles.cartBumpActive)}
        aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} ${wishCount === 1 ? "item" : "items"}` : ""}`}
      >
        <HeartIcon className={styles.actionIcon} />
        {mounted && <CountBadge count={wishCount} />}
      </Link>
      <button

        type="button"
        data-cart-target="true"
        onClick={onOpenCart}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.shortcutBtn, cartBump && styles.cartBumpActive)}
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

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 12))

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
              <Suspense
                fallback={
                  <MobileNavItems
                    links={PRIMARY_NAV_LINKS}
                    categories={categories}
                    pathname={null}
                    onNavigate={closeMobile}
                  />
                }
              >
                <MobileNavWithPath links={PRIMARY_NAV_LINKS} categories={categories} onNavigate={closeMobile} />
              </Suspense>
            </nav>
          </SheetContent>
        </Sheet>

        <Logo className={styles.brandLogo} />

        <nav className={styles.desktopNav} aria-label="Main">
          <Suspense fallback={<DesktopNavItems links={PRIMARY_NAV_LINKS} categories={categories} pathname={null} />}>
            <DesktopNavWithPath links={PRIMARY_NAV_LINKS} categories={categories} />
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
              cartBump={cartBump}
              wishlistBump={wishlistBump}
              onOpenCart={() => openCart(true)}
            />
          </Suspense>
          <Link
            href="/wishlist"
            data-wishlist-target="true"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.desktopActionBtn, wishlistBump && styles.cartBumpActive)}
            aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} ${wishCount === 1 ? "item" : "items"}` : ""}`}
          >
            <HeartIcon className={styles.actionIcon} />
            {mounted && <CountBadge count={wishCount} />}
          </Link>
          <button
            type="button"
            data-cart-target="true"
            onClick={() => openCart(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.desktopActionBtn, cartBump && styles.cartBumpActive)}
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

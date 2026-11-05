"use client"

import { HeartIcon, MenuIcon, SearchIcon, ShoppingBagIcon } from "lucide-react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
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

export type NavCategory = { name: string; slug: string }
type NavLinkItem = { href: string; label: string }

const isActive = (pathname: string | null, href: string) =>
  pathname !== null && (pathname === href || pathname.startsWith(`${href}/`))

function CountBadge({ count }: { count: number }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span data-ui="store/CountBadge/m-span-grid"
          key={count}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 600, damping: 20 }}
          className="absolute top-0.5 right-0.5 grid min-w-4.6 place-items-center rounded-full bg-primary px-1 text-[0.65rem] leading-4.6 font-bold text-primary-foreground ring-2 ring-background"
        >
          {count > 99 ? "99+" : count}
        </motion.span>
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
          <ScrollLink data-ui="store/DesktopNavItems/ScrollLink"
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-3.5 py-2 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground",
              active && "text-foreground"
            )}
          >
            {active && (
              <motion.span data-ui="store/DesktopNavItems/m-span-absolute"
                layoutId="nav-pill"
                className="absolute inset-0 -z-10 rounded-full bg-secondary"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {l.label}
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
        <motion.div data-ui="store/MobileNavItems/m-div" key={l.href} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
          <ScrollLink data-ui="store/MobileNavItems/ScrollLink"
            href={l.href}
            onClick={onNavigate}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(
              "block rounded-xl px-4 py-3 text-base font-medium transition-colors hover:bg-muted",
              isActive(pathname, l.href) && "bg-secondary text-primary"
            )}
          >
            {l.label}
          </ScrollLink>
        </motion.div>
      ))}
    </>
  )
}

function MobileNavWithPath(props: { links: NavLinkItem[]; onNavigate: () => void }) {
  return <MobileNavItems {...props} pathname={usePathname()} />
}

export function Header({ categories }: { categories: NavCategory[] }) {
  const mounted = useMounted()
  const items = useCart((s) => s.items)
  const openCart = useCart((s) => s.setOpen)
  const wishCount = useWishlist((s) => s.ids.length)
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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
    <header data-ui="store/Header"
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled ? "glass border-b shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)]" : "border-b border-transparent"
      )}
    >
      <div data-ui="store/Header/div-flex" className="container-page flex h-(--store-header-h) items-center gap-1.5 sm:gap-3">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger data-ui="store/Header/SheetTrigger-open-menu"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full lg:hidden")}
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </SheetTrigger>
          <SheetContent data-ui="store/Header/SheetContent" side="left" className="w-80">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <Logo />
            </SheetHeader>
            <nav data-ui="store/Header/nav-mobile" className="flex flex-col gap-1 px-3" aria-label="Mobile">
              <Suspense fallback={<MobileNavItems links={mobileLinks} pathname={null} onNavigate={closeMobile} />}>
                <MobileNavWithPath links={mobileLinks} onNavigate={closeMobile} />
              </Suspense>
            </nav>
            <div data-ui="store/Header/div-flex-2" className="mt-auto flex items-center justify-end gap-3 border-t p-4 text-sm">
              <div data-ui="store/Header/div-flex-3" className="flex items-center gap-2 text-muted-foreground">
                Theme <ThemeToggle />
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Logo />

        <nav data-ui="store/Header/nav-main" className="ml-8 hidden items-center gap-1 lg:flex" aria-label="Main">
          <Suspense fallback={<DesktopNavItems links={links} pathname={null} />}>
            <DesktopNavWithPath links={links} />
          </Suspense>
        </nav>

        <div data-ui="store/Header/div-flex-4" className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <Link data-ui="store/Header/Link-search-products"
            href="/products"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "hidden rounded-full sm:inline-flex")}
            aria-label="Search products"
          >
            <SearchIcon className="size-4.6" />
          </Link>
          <div data-ui="store/Header/div-hidden" className="hidden sm:block">
            <ThemeToggle />
          </div>
          <Link data-ui="store/Header/Link"
            href="/wishlist"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full max-sm:size-9")}
            aria-label={`Wishlist${mounted && wishCount ? `, ${wishCount} items` : ""}`}
          >
            <HeartIcon className="size-4.6" />
            {mounted && <CountBadge count={wishCount} />}
          </Link>
          <button data-ui="store/Header/button"
            type="button"
            onClick={() => openCart(true)}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full max-sm:size-9")}
            aria-label={`Open cart${mounted ? `, ${cartCount(items)} items` : ""}`}
          >
            <ShoppingBagIcon className="size-4.6" />
            {mounted && <CountBadge count={cartCount(items)} />}
          </button>
          <span data-ui="store/Header/span" className="max-sm:ml-1.5"><AccountMenu /></span>
        </div>
      </div>
    </header>
  )
}

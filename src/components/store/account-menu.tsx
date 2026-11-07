"use client"

import { HeartIcon, LogInIcon, LogOutIcon, PackageIcon, PackageSearchIcon, ShoppingBagIcon, UserIcon, UserRoundIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { useState } from "react"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useMounted } from "@/hooks/use-mounted"
import { useAuth } from "@/store/auth"
import { cartCount, useCart } from "@/store/cart"
import { useWishlist } from "@/store/wishlist"

/** Wishlist / cart rows of the menu: only needed on phones, where the header has no room for their icons. */
function PhoneShortcuts({ onCart, onWishlist, wishCount, cartItems }: { onCart: () => void; onWishlist: () => void; wishCount: number; cartItems: number }) {
  return (
    <>
      <DropdownMenuItem data-ui="store/PhoneShortcuts/DropdownMenuItem" className="sm:hidden" onClick={onWishlist}>
        <HeartIcon /> Wishlist
        {wishCount > 0 && <span data-ui="store/PhoneShortcuts/span" className="ml-auto text-xs font-semibold text-primary">{wishCount}</span>}
      </DropdownMenuItem>
      <DropdownMenuItem data-ui="store/PhoneShortcuts/DropdownMenuItem-2" className="sm:hidden" onClick={onCart}>
        <ShoppingBagIcon /> Cart
        {cartItems > 0 && <span data-ui="store/PhoneShortcuts/span-2" className="ml-auto text-xs font-semibold text-primary">{cartItems}</span>}
      </DropdownMenuItem>
    </>
  )
}

export function AccountMenu() {
  const { user, ready } = useAuth()
  const router = useRouter()
  const mounted = useMounted()
  const openCart = useCart((s) => s.setOpen)
  const cartItems = useCart((s) => cartCount(s.items))
  const wishCount = useWishlist((s) => s.ids.length)
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  if (!ready) return <span data-ui="store/AccountMenu" className="size-10 max-sm:size-9" aria-hidden />

  const signOut = async () => {
    setSigningOut(true)
    await getBrowserSupabase()?.auth.signOut()
    setAskSignOut(false)
    setSigningOut(false)
    router.push("/")
    router.refresh()
  }

  // On phones the wishlist and cart live in this menu, so a dot on the icon says "something is in there".
  const phoneCount = mounted ? wishCount + cartItems : 0
  const shortcuts = (
    <PhoneShortcuts onCart={() => openCart(true)} onWishlist={() => router.push("/wishlist")} wishCount={mounted ? wishCount : 0} cartItems={mounted ? cartItems : 0} />
  )

  return (
    <>
      {/* Web: the guest icon goes straight to the login page. Phones get the dropdown below (it also holds wishlist and cart). */}
      {!user && (
        <Link data-ui="store/AccountMenu/Link-sign-in" href="/login" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "hidden rounded-full sm:inline-flex")} aria-label="Sign in">
          <UserRoundIcon className="size-4.6" />
        </Link>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger data-ui="store/AccountMenu/DropdownMenuTrigger"
          className={cn(
            "relative grid place-items-center rounded-full transition",
            user
              ? "size-10 max-sm:size-9 ring-2 ring-primary/20 hover:ring-primary/50"
              : cn(buttonVariants({ variant: "ghost", size: "icon" }), "max-sm:size-9 sm:hidden")
          )}
          aria-label={user ? "Account menu" : "Sign in and more"}
        >
          {user ? (
            user.avatarUrl ? (
              <Image data-ui="store/AccountMenu/Image" src={user.avatarUrl} alt="" width={36} height={36} className="size-full overflow-hidden rounded-full object-cover" />
            ) : (
              <span data-ui="store/AccountMenu/span" className="font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
            )
          ) : (
            <UserRoundIcon className="size-4.6" />
          )}
          {phoneCount > 0 && (
            <span data-ui="store/AccountMenu/span-absolute" aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background sm:hidden" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent data-ui="store/AccountMenu/DropdownMenuContent" align="end" className="w-56">
          {user ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">
                  <span data-ui="store/AccountMenu/span-2" className="block text-sm font-semibold text-foreground">{user.name}</span>
                  <span data-ui="store/AccountMenu/span-3" className="block truncate">{user.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem" onClick={() => router.push("/account/orders")}>
                <PackageIcon /> My orders
              </DropdownMenuItem>
              {shortcuts}
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-2" className="max-sm:hidden" onClick={() => router.push("/wishlist")}>
                <HeartIcon /> Wishlist
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-3" onClick={() => router.push("/account/profile")}>
                <UserIcon /> Profile & address
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-4" variant="destructive" onClick={() => setAskSignOut(true)}>
                <LogOutIcon /> Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-5" onClick={() => router.push("/login")}>
                <LogInIcon /> Sign in
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-6" onClick={() => router.push("/track")}>
                <PackageSearchIcon /> Track order
              </DropdownMenuItem>
              {shortcuts}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={askSignOut}
        onOpenChange={setAskSignOut}
        title="Sign out?"
        description="You can sign in again any time. Items in your cart stay on this device."
        confirmLabel="Sign out"
        pending={signingOut}
        onConfirm={signOut}
      />
    </>
  )
}

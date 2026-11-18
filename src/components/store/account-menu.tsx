"use client"

import { LogInIcon, LogOutIcon, MapPinIcon, PackageIcon, PackageSearchIcon, SettingsIcon, UserIcon, UserRoundIcon } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ThemeSegmentedControl } from "@/components/shared/theme-toggle"
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
import { useAuth } from "@/store/auth"

export function AccountMenu() {
  const { user, ready } = useAuth()
  const router = useRouter()
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  if (!ready) return <span data-ui="store/AccountMenu" className="size-10 max-sm:size-9" aria-hidden />

  const signOut = async () => {
    setSigningOut(true)
    try {
      sessionStorage.removeItem("kk-last-order")
    } catch {}
    await getBrowserSupabase()?.auth.signOut()
    setAskSignOut(false)
    setSigningOut(false)
    router.push("/")
    router.refresh()
  }

  return (
    <>
      {/* Web: the guest icon goes straight to the login page. Phones get the dropdown below. */}
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
        </DropdownMenuTrigger>
        <DropdownMenuContent data-ui="store/AccountMenu/DropdownMenuContent" align="end" className="w-56 border border-border/80 bg-popover/98 shadow-xl">
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
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-2" onClick={() => router.push("/account/profile")}>
                <UserIcon /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-3" onClick={() => router.push("/account/profile?tab=addresses")}>
                <MapPinIcon /> Addresses
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-4" onClick={() => router.push("/account/profile?tab=settings")}>
                <SettingsIcon /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-5" variant="destructive" onClick={() => setAskSignOut(true)}>
                <LogOutIcon /> Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-6" onClick={() => router.push("/login")}>
                <LogInIcon /> Sign in
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-7" onClick={() => router.push("/track")}>
                <PackageSearchIcon /> Track order
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div data-ui="store/AccountMenu/div" className="px-2 py-1.5">
                <p data-ui="store/AccountMenu/p" className="mb-1.5 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Settings · Theme
                </p>
                <ThemeSegmentedControl />
              </div>
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

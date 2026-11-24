"use client"

import { LogInIcon, LogOutIcon, MapPinIcon, PackageIcon, PackageSearchIcon, SettingsIcon, UserIcon, UserRoundIcon } from "lucide-react"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
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
import { Skeletonize } from "@/components/shared/skeletonize"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { signOutCustomer } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { Suspense, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"

function PathnameSync({ onPathname }: { onPathname: (pathname: string | null) => void }) {
  const pathname = usePathname()
  useEffect(() => {
    onPathname(pathname)
  }, [pathname, onPathname])
  return null
}

function buildLoginHref(pathname: string | null): string {
  if (!pathname || pathname === "/" || pathname === "/login" || pathname.startsWith("/login/")) {
    return "/login"
  }
  return `/login?next=${encodeURIComponent(pathname)}`
}

export function AccountMenu() {
  const { user, ready } = useAuth()
  const router = useRouter()
  const [pathname, setPathname] = useState<string | null>(null)
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  useBlockWhile(signingOut)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(signingOut)

  if (!ready) {
    return (
      <Skeletonize label="Loading account">
        <span data-ui="store/AccountMenu/span-grid" className="grid size-10 place-items-center rounded-full border max-sm:size-9">
          <UserRoundIcon className="size-4.5" />
        </span>
      </Skeletonize>
    )
  }

  const loginHref = buildLoginHref(pathname)

  const signOut = () =>
    startSignOut(async () => {
      setAskSignOut(false)
      try {
        const res = await signOutCustomer()
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't sign out. Please try again.")
          return
        }
        applyClientSignOut()
        await getBrowserSupabase()?.auth.signOut({ scope: "local" })
        showSuccess("Signed out")
        later(() => toast.success("Signed out successfully"))
        router.replace("/")
      } catch {
        toast.error("Couldn't sign out. Please try again.")
      }
    })

  return (
    <>
      <Suspense fallback={null}>
        <PathnameSync onPathname={setPathname} />
      </Suspense>
      <DropdownMenu>
        <DropdownMenuTrigger data-ui="store/AccountMenu/DropdownMenuTrigger"
          className={cn(
            "relative grid place-items-center rounded-full transition",
            user
              ? "size-10 max-sm:size-9 ring-2 ring-primary/20 hover:ring-primary/50"
              : cn(buttonVariants({ variant: "ghost", size: "icon" }), "max-sm:size-9")
          )}
          aria-label={user ? "Account menu" : "Sign in and theme settings"}
        >
          {user ? (
            user.avatarUrl ? (
              <Image data-ui="store/AccountMenu/Image" src={user.avatarUrl} alt="" width={36} height={36} sizes="36px" className="size-full overflow-hidden rounded-full object-cover" />
            ) : (
              <span data-ui="store/AccountMenu/span" className="font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
            )
          ) : (
            <UserRoundIcon className="size-4.5" />
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
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-4" className="sm:hidden" onClick={() => router.push("/account/profile?tab=settings")}>
                <SettingsIcon /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <div data-ui="store/AccountMenu/div" className="px-2 py-1.5 sm:hidden">
                <p data-ui="store/AccountMenu/p" className="mb-1.5 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Theme
                </p>
                <ThemeSegmentedControl />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-5" variant="destructive" onClick={() => setAskSignOut(true)}>
                <LogOutIcon /> Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-6" onClick={() => router.push(loginHref)}>
                <LogInIcon /> Sign in
              </DropdownMenuItem>
              <DropdownMenuItem data-ui="store/AccountMenu/DropdownMenuItem-7" onClick={() => router.push("/track")}>
                <PackageSearchIcon /> Track order
              </DropdownMenuItem>
              <DropdownMenuSeparator className="sm:hidden" />
              <div data-ui="store/AccountMenu/div-2" className="px-2 py-1.5 sm:hidden">
                <p data-ui="store/AccountMenu/p-2" className="mb-1.5 px-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
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

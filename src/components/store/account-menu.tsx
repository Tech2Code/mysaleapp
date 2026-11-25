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
import styles from "./store-widgets.module.css"

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
        <span className={styles.skeletonAvatar}>
          <UserRoundIcon className={styles.userIconSvg} />
        </span>
      </Skeletonize>
    )
  }

  const loginHref = buildLoginHref(pathname)

  const signOut = () =>
    startSignOut(async () => {
      try {
        const res = await signOutCustomer()
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't sign out. Please try again.")
          return
        }
        applyClientSignOut()
        await getBrowserSupabase()?.auth.signOut({ scope: "local" })
        setAskSignOut(false)
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
        <DropdownMenuTrigger
          className={cn(
            styles.menuTrigger,
            user
              ? styles.menuTriggerSignedIn
              : cn(buttonVariants({ variant: "ghost", size: "icon" }), styles.menuTriggerGuest)
          )}
          aria-label={user ? "Account menu" : "Sign in and theme settings"}
        >
          {user ? (
            user.avatarUrl ? (
              <Image src={user.avatarUrl} alt="" width={36} height={36} sizes="36px" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</span>
            )
          ) : (
            <UserRoundIcon className={styles.userIconSvg} />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.menuDropdown}>
          {user ? (
            <>
              <DropdownMenuGroup>
                <DropdownMenuLabel className={styles.userLabelGroup}>
                  <span className={styles.userNameText}>{user.name}</span>
                  <span className={styles.userEmailText}>{user.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/account/orders")}>
                <PackageIcon /> My orders
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/account/profile")}>
                <UserIcon /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/account/profile?tab=addresses")}>
                <MapPinIcon /> Addresses
              </DropdownMenuItem>
              <DropdownMenuItem className={styles.mobileOnlyItem} onClick={() => router.push("/account/profile?tab=settings")}>
                <SettingsIcon /> Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className={styles.mobileOnlySep} />
              <div className={styles.mobileThemeSection}>
                <p className={styles.themeSectionHeading}>
                  Theme
                </p>
                <ThemeSegmentedControl />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setAskSignOut(true)}>
                <LogOutIcon /> Sign out
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => router.push(loginHref)}>
                <LogInIcon /> Sign in
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/track")}>
                <PackageSearchIcon /> Track order
              </DropdownMenuItem>
              <DropdownMenuSeparator className={styles.mobileOnlySep} />
              <div className={styles.mobileThemeSection}>
                <p className={styles.themeSectionHeading}>
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
        onOpenChange={(o) => !signingOut && setAskSignOut(o)}
        title="Sign out?"
        description="You can sign in again any time. Items in your cart stay on this device."
        confirmLabel="Sign out"
        pending={signingOut}
        onConfirm={signOut}
      />
    </>
  )
}

"use client"

import { LogOutIcon, MapPinIcon, PackageIcon, SettingsIcon, UserIcon } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ThemeSettingSection } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import { signOutCustomer } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import styles from "./account.module.css"

const links = [
  { key: "orders", href: "/account/orders", label: "My orders", mobileLabel: "Orders", icon: PackageIcon },
  { key: "profile", href: "/account/profile", label: "Profile", mobileLabel: "Profile", icon: UserIcon },
  { key: "addresses", href: "/account/profile?tab=addresses", label: "Addresses", mobileLabel: "Addresses", icon: MapPinIcon },
  { key: "settings", href: "/account/profile?tab=settings", label: "Settings", mobileLabel: "Settings", icon: SettingsIcon },
] as const

function NavItems({ pathname, tab }: { pathname: string | null; tab: string | null }) {
  return (
    <>
      {links.map((l) => {
        const isProfilePath = pathname?.startsWith("/account/profile") ?? false
        const active =
          l.key === "orders"
            ? (pathname?.startsWith("/account/orders") ?? false)
            : l.key === "addresses"
              ? isProfilePath && tab === "addresses"
              : l.key === "settings"
                ? isProfilePath && tab === "settings"
                : isProfilePath && tab !== "addresses" && tab !== "settings"
        return (
          <Link

            key={l.key}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              styles.navLink,
              l.key === "settings" && styles.navLinkSettings,
              active && styles.navLinkActive
            )}
          >
            <l.icon className={styles.navIcon} />
            <span className={styles.mobileLabelText}>{l.mobileLabel}</span>
            <span className={styles.desktopLabelText}>{l.label}</span>
          </Link>
        )
      })}
    </>
  )
}

function NavItemsWithPath() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  return <NavItems pathname={pathname} tab={searchParams.get("tab")} />
}

export function AccountNav() {
  return (
    <nav aria-label="Account" className={styles.accountNav}>
      <Suspense fallback={<NavItems pathname={null} tab={null} />}>
        <NavItemsWithPath />
      </Suspense>
    </nav>
  )
}

function AccountSignOutCard() {
  const router = useRouter()
  const [askSignOut, setAskSignOut] = useState(false)
  const [signingOut, startSignOut] = useTransition()
  useBlockWhile(signingOut)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(signingOut)

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
      <div

        className={styles.signOutCard}
      >
        <div className={styles.signOutTextCol}>
          <h3 className={styles.signOutHeading}>Sign out</h3>
          <p className={styles.signOutDesc}>Sign out of your account on this device. Items in your cart will stay saved.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className={styles.signOutOutlineBtn}
          onClick={() => setAskSignOut(true)}
        >
          <LogOutIcon className={styles.icon16} /> Sign out
        </Button>
      </div>
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

function ProfileTabSwitchInner({
  profileContent,
  addressesContent,
}: {
  profileContent: ReactNode
  addressesContent: ReactNode
}) {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab")

  if (tab === "settings") {
    return (
      <section aria-labelledby="settings-page-title" className={styles.settingsSection}>
        <div>
          <h2 id="settings-page-title" className={styles.pageTitle}>Settings</h2>
          <p className={styles.pageSubtitle}>Customize your app appearance and account preferences.</p>
        </div>
        <div className={styles.settingsCardsStack}>
          <ThemeSettingSection />
          <AccountSignOutCard />
        </div>
      </section>
    )
  }

  if (tab === "addresses") {
    return <>{addressesContent}</>
  }

  return <>{profileContent}</>
}

export function ProfileOrSettingsView({
  profileContent,
  addressesContent,
}: {
  profileContent: ReactNode
  addressesContent: ReactNode
}) {
  return (
    <Suspense fallback={profileContent}>
      <ProfileTabSwitchInner profileContent={profileContent} addressesContent={addressesContent} />
    </Suspense>
  )
}

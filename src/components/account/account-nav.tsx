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
            data-ui="account/NavItems/Link"
            key={l.key}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[11px]/tight font-medium transition-colors sm:flex-row sm:justify-start sm:gap-3 sm:px-4 sm:py-3 sm:text-sm",
              l.key === "settings" && "sm:hidden",
              active ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-card hover:bg-muted lg:bg-transparent"
            )}
          >
            <l.icon data-ui="account/NavItems/l.icon" className="size-4 shrink-0" />
            <span data-ui="account/NavItems/span" className="truncate sm:hidden">{l.mobileLabel}</span>
            <span data-ui="account/NavItems/span-hidden" className="hidden truncate sm:inline">{l.label}</span>
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
    <nav data-ui="account/AccountNav" aria-label="Account" className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2 lg:flex-col">
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
      await signOutCustomer()
      applyClientSignOut()
      await getBrowserSupabase()?.auth.signOut({ scope: "local" })
      showSuccess("Signed out")
      later(() => toast.success("Signed out successfully"))
      router.replace("/")
    })

  return (
    <>
      <div
        data-ui="account/AccountSignOutCard/div-flex"
        className="flex flex-col gap-3 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div data-ui="account/AccountSignOutCard/div" className="space-y-0.5">
          <h3 data-ui="account/AccountSignOutCard/h3-sign-out" className="font-sans text-base font-semibold">Sign out</h3>
          <p data-ui="account/AccountSignOutCard/p" className="text-xs text-muted-foreground">Sign out of your account on this device. Items in your cart will stay saved.</p>
        </div>
        <Button data-ui="account/AccountSignOutCard/Button-sign-out"
          type="button"
          variant="outline"
          className="h-10 rounded-full border-destructive/30 px-5 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
          onClick={() => setAskSignOut(true)}
        >
          <LogOutIcon className="size-4" /> Sign out
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
      <section data-ui="account/ProfileTabSwitchInner" aria-labelledby="settings-page-title" className="space-y-6">
        <div data-ui="account/ProfileTabSwitchInner/div">
          <h2 data-ui="account/ProfileTabSwitchInner/h2-settings" id="settings-page-title" className="text-3xl font-semibold">Settings</h2>
          <p data-ui="account/ProfileTabSwitchInner/p" className="mt-1 text-muted-foreground">Customize your app appearance and account preferences.</p>
        </div>
        <div data-ui="account/ProfileTabSwitchInner/div-2" className="space-y-4">
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

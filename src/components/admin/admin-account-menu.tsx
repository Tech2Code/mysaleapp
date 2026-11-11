"use client"

import { LogOutIcon, SettingsIcon, ShieldCheckIcon, UserRoundCogIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"
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
import { signOutAdmin } from "@/features/auth/actions"
import { useBlockWhile } from "@/components/shared/busy-overlay"

export type AdminAccount = { name: string; email: string; avatarUrl: string | null; lastSignIn: string | null }

/** Who is signed in to the admin panel, plus quick links and Sign out. */
export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [askSignOut, setAskSignOut] = useState(false)
  useBlockWhile(pending)
  const initial = (account.name || account.email).charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-ui="admin/AdminAccountMenu/DropdownMenuTrigger-grid"
        className="grid size-9 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-primary/20 transition hover:ring-primary/50"
        aria-label={`Account: ${account.email}`}
      >
        {account.avatarUrl ? (
          <Image data-ui="admin/AdminAccountMenu/Image" src={account.avatarUrl} alt="" width={36} height={36} className="size-full object-cover" />
        ) : (
          <span data-ui="admin/AdminAccountMenu/span" className="text-sm leading-none font-semibold text-primary">{initial}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent data-ui="admin/AdminAccountMenu/DropdownMenuContent" align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-1 py-2">
            <span data-ui="admin/AdminAccountMenu/span-2" className="block truncate text-sm font-semibold text-foreground">{account.name}</span>
            <span data-ui="admin/AdminAccountMenu/span-3" className="block truncate">{account.email}</span>
            <span data-ui="admin/AdminAccountMenu/span-inline-flex" className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
              <ShieldCheckIcon className="size-3" aria-hidden /> Administrator
            </span>
            {account.lastSignIn && <span data-ui="admin/AdminAccountMenu/span-4" className="block pt-1 text-[0.7rem]">Signed in {account.lastSignIn}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem" onClick={() => router.push("/admin/account")}>
          <UserRoundCogIcon /> My account
        </DropdownMenuItem>
        <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem-2" onClick={() => router.push("/admin/settings")}>
          <SettingsIcon /> Store settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem-4" variant="destructive" disabled={pending} onClick={() => setAskSignOut(true)}>
          <LogOutIcon /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ConfirmDialog
        open={askSignOut}
        onOpenChange={setAskSignOut}
        title="Sign out?"
        description="You will need to sign in again to use the admin panel."
        confirmLabel="Sign out"
        destructive
        pending={pending}
        onConfirm={() => startTransition(() => signOutAdmin())}
      />
    </DropdownMenu>
  )
}

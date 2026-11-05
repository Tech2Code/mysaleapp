"use client"

import { ExternalLinkIcon, LogOutIcon, SettingsIcon, ShieldCheckIcon, UserRoundCogIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutAdmin } from "@/features/auth/actions"

export type AdminAccount = { name: string; email: string; avatarUrl: string | null; lastSignIn: string | null }

/** Who is signed in to the admin panel, plus quick links and Sign out. */
export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const initial = (account.name || account.email).charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-ui="admin/AdminAccountMenu"
        className="grid size-9 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-primary/20 transition hover:ring-primary/50"
        aria-label={`Account: ${account.email}`}
      >
        {account.avatarUrl ? (
          <Image src={account.avatarUrl} alt="" width={36} height={36} className="size-full object-cover" />
        ) : (
          <span className="text-sm leading-none font-semibold text-primary">{initial}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="space-y-1 py-2">
            <span className="block truncate text-sm font-semibold text-foreground">{account.name}</span>
            <span className="block truncate">{account.email}</span>
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
              <ShieldCheckIcon className="size-3" aria-hidden /> Administrator
            </span>
            {account.lastSignIn && <span className="block pt-1 text-[0.7rem]">Signed in {account.lastSignIn}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/admin/account")}>
          <UserRoundCogIcon /> My account
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
          <SettingsIcon /> Store settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open("/", "_blank")}>
          <ExternalLinkIcon /> View store
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => startTransition(() => signOutAdmin())}>
          <LogOutIcon /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

"use client"

import { HeartIcon, LogOutIcon, PackageIcon, UserIcon, UserRoundIcon } from "lucide-react"
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
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useAuth } from "@/store/auth"

export function AccountMenu() {
  const { user, ready } = useAuth()
  const router = useRouter()

  if (!ready) return <span data-ui="store/AccountMenu" className="size-10" aria-hidden />

  if (!user) {
    return (
      <Link
        href="/login"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full")}
        aria-label="Sign in"
      >
        <UserRoundIcon className="size-[1.15rem]" />
      </Link>
    )
  }

  const signOut = async () => {
    await getBrowserSupabase()?.auth.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="grid size-10 place-items-center overflow-hidden rounded-full ring-2 ring-primary/20 transition hover:ring-primary/50"
        aria-label="Account menu"
      >
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt="" width={36} height={36} className="size-full object-cover" />
        ) : (
          <span className="font-semibold text-primary">{user.name.charAt(0).toUpperCase()}</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">
            <span className="block text-sm font-semibold text-foreground">{user.name}</span>
            <span className="block truncate">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/account/orders")}>
          <PackageIcon /> My orders
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/wishlist")}>
          <HeartIcon /> Wishlist
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/account/profile")}>
          <UserIcon /> Profile & address
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

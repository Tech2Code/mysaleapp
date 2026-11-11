import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { ProfileView } from "@/components/account/account-views"
import { getMyProfile } from "@/features/account/actions"
import { listMyAddresses } from "@/features/addresses/actions"

export const metadata: Metadata = { title: "Profile & address", robots: { index: false, follow: false } }

export default async function ProfilePage() {
  const [profile, addresses] = await Promise.all([getMyProfile(), listMyAddresses()])
  if (!profile) redirect("/login?next=/account/profile")

  return <ProfileView profile={profile} addresses={addresses} />
}

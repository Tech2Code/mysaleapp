import { redirect } from "next/navigation"
import { Suspense } from "react"
import { AddressBook } from "@/components/account/address-book"
import { ProfileForm } from "@/components/account/profile-form"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/account/actions"
import { listMyAddresses } from "@/features/addresses/actions"

async function ProfileSection() {
  const [profile, addresses] = await Promise.all([getMyProfile(), listMyAddresses()])
  if (!profile) redirect("/login?next=/account/profile")

  return (
    <div data-ui="page:/account/profile#ProfileSection" className="space-y-8 sm:space-y-12">
      <section aria-labelledby="profile-title" className="space-y-4">
        <h2 id="profile-title" className="text-2xl font-semibold">
          Your details
        </h2>
        <ProfileForm profile={profile} />
      </section>
      <AddressBook addresses={addresses} defaults={{ fullName: profile.fullName, phone: profile.phone }} />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <section data-ui="page:/account/profile">
      <h2 className="text-3xl font-semibold">Profile & addresses</h2>
      <p className="mt-1 mb-8 text-muted-foreground">Manage your details and saved delivery addresses.</p>
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <ProfileSection />
      </Suspense>
    </section>
  )
}

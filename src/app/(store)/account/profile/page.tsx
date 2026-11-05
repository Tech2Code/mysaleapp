import { redirect } from "next/navigation"
import { Suspense } from "react"
import { ProfileForm } from "@/components/account/profile-form"
import { Skeleton } from "@/components/ui/skeleton"
import { getMyProfile } from "@/features/account/actions"

async function ProfileSection() {
  const profile = await getMyProfile()
  if (!profile) redirect("/login?next=/account/profile")
  return <ProfileForm profile={profile} />
}

export default function ProfilePage() {
  return (
    <section>
      <h2 className="text-3xl font-semibold">Profile & address</h2>
      <p className="mt-1 mb-6 text-muted-foreground">Saved details are filled in automatically at checkout.</p>
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <ProfileSection />
      </Suspense>
    </section>
  )
}

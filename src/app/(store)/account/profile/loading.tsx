import { ProfileView } from "@/components/account/account-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderAddresses, placeholderProfile } from "@/features/account/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <ProfileView profile={placeholderProfile()} addresses={placeholderAddresses()} />
    </Skeletonize>
  )
}

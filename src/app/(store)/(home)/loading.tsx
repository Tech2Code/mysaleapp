import { Skeletonize } from "@/components/shared/skeletonize"
import { HomeView } from "@/components/store/home-view"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"
import { placeholderCards, placeholderCategoriesWithCounts } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <HomeView featured={placeholderCards(8)} all={placeholderCards(8)} categories={placeholderCategoriesWithCounts()} shop={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

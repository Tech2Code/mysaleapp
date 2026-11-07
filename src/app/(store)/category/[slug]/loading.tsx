import { Skeletonize } from "@/components/shared/skeletonize"
import { CategoryView } from "@/components/store/category-view"
import { placeholderCards, placeholderCategory } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <CategoryView category={placeholderCategory()} products={placeholderCards(8)} />
    </Skeletonize>
  )
}

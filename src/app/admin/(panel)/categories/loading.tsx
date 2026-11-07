import { CategoriesView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderCategoriesWithProductCount } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <CategoriesView categories={placeholderCategoriesWithProductCount(5)} />
    </Skeletonize>
  )
}

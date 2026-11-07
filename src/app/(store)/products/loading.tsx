import { Skeletonize } from "@/components/shared/skeletonize"
import { ProductsPageView } from "@/components/store/page-views"
import { placeholderCategories, placeholderListItems } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <ProductsPageView items={placeholderListItems(8)} categories={placeholderCategories(5)} />
    </Skeletonize>
  )
}

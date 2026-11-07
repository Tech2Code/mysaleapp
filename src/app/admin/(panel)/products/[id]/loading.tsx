import { ProductFormView } from "@/components/admin/page-views"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderCategories, placeholderProduct } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <ProductFormView product={placeholderProduct()} categories={placeholderCategories(3)} />
    </Skeletonize>
  )
}

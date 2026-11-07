import { ProductsView } from "@/components/admin/products-view"
import { Skeletonize } from "@/components/shared/skeletonize"
import { placeholderProducts } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <ProductsView products={placeholderProducts(12)} />
    </Skeletonize>
  )
}

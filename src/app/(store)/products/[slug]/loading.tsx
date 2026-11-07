import { Skeletonize } from "@/components/shared/skeletonize"
import { ProductDetailView } from "@/components/store/product-detail-view"
import { placeholderCards, placeholderProduct } from "@/features/products/placeholders"
import { DEFAULT_SETTINGS } from "@/features/settings/defaults"

export default function Loading() {
  return (
    <Skeletonize>
      <ProductDetailView product={placeholderProduct()} related={placeholderCards(4)} settings={DEFAULT_SETTINGS} />
    </Skeletonize>
  )
}

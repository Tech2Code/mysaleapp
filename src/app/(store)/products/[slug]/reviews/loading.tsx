import { Skeletonize } from "@/components/shared/skeletonize"
import { ProductReviewsPageView } from "@/components/store/product-actions"
import { placeholderProduct, placeholderReviews } from "@/features/products/placeholders"

export default function Loading() {
  return (
    <Skeletonize>
      <ProductReviewsPageView product={placeholderProduct()} reviews={placeholderReviews(4)} />
    </Skeletonize>
  )
}

import { Stagger, StaggerItem } from "@/components/shared/motion"
import { toCardData, type ProductCardData } from "@/features/products/types"
import { ProductCard } from "./product-card"

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <Stagger className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <StaggerItem key={product.id}>
          {/* Slim projection: callers may pass full Products, which must not be serialized to the client. */}
          <ProductCard product={toCardData(product)} priority={i < priorityCount} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

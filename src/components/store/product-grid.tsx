import { Stagger, StaggerItem } from "@/components/shared/motion"
import { ProductCard, type ProductCardData } from "./product-card"

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <Stagger className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product, i) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} priority={i < priorityCount} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

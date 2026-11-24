import { Stagger, StaggerItem } from "@/components/shared/motion"
import { toCardData, type ProductCardData } from "@/features/products/types"
import { ProductCard } from "./product-card"
import styles from "./product-card.module.css"

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <Stagger className={styles.productGrid}>
      {products.map((product, i) => (
        <StaggerItem key={product.id}>
          {/* Slim projection: callers may pass full Products, which must not be serialized to the client. */}
          <ProductCard product={toCardData(product)} priority={i < priorityCount} />
        </StaggerItem>
      ))}
    </Stagger>
  )
}

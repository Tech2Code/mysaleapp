import { PageHeader } from "@/components/store/page-header"
import { ProductGrid } from "@/components/store/product-grid"
import type { Category, ProductCardData } from "@/features/products/types"
import styles from "./page-views.module.css"

/** A category page body (no JSON-LD). The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function CategoryView({ category, products }: { category: Pick<Category, "name" | "description">; products: ProductCardData[] }) {
  return (
    <>
      <PageHeader
        title={category.name}
        description={category.description}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: category.name }]}
      />
      <div className={styles.pageBodyContainer}>
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p className={styles.emptyCollectionBox}>
            New products for this category are coming soon. Check back shortly!
          </p>
        )}
      </div>
    </>
  )
}

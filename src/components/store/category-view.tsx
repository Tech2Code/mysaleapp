import { PageHeader } from "@/components/store/page-header"
import { ProductGrid } from "@/components/store/product-grid"
import type { Category, ProductCardData } from "@/features/products/types"

/** A category page body (no JSON-LD). The page passes real data; loading.tsx passes placeholders inside <Skeletonize>. */
export function CategoryView({ category, products }: { category: Pick<Category, "name" | "description">; products: ProductCardData[] }) {
  return (
    <>
      <PageHeader
        title={category.name}
        description={category.description}
        breadcrumbs={[{ name: "Home", href: "/" }, { name: "Shop", href: "/products" }, { name: category.name }]}
      />
      <div data-ui="store/CategoryView/div" className="container-page pt-4 sm:pt-6">
        {products.length ? (
          <ProductGrid products={products} />
        ) : (
          <p data-ui="store/CategoryView/p" className="rounded-3xl border border-dashed py-14 sm:py-20 text-center text-muted-foreground">
            New pieces for this collection are being crafted. Check back soon!
          </p>
        )}
      </div>
    </>
  )
}

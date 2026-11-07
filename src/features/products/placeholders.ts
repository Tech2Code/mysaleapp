import type { LiveCartLine } from "@/components/store/live-cart"
import type { Category, Product, ProductCardData, ProductListItem } from "./types"

/**
 * Placeholder data for loading states (rendered inside `<Skeletonize>`; see components/shared/skeletonize.tsx).
 * Only the SHAPE matters: text is hidden by the skeleton CSS, but lengths decide how wide a block is.
 * The one place per entity: add a field to the type, add it here (tsc forces you to).
 */

const NAMES = ["Hand-painted clay diya set", "Macrame wall hanging", "Scented soy candle jar", "Woven jute basket", "Terracotta planter", "Embroidered cushion", "Brass tea-light holder", "Wooden serving tray"]
const CATEGORIES = ["Home decor", "Candles", "Gifts"]

export function placeholderCategory(i = 0): Category {
  return { id: `ph-cat-${i}`, name: CATEGORIES[i % CATEGORIES.length], slug: `ph-cat-${i}`, description: "A short description of this collection", imageUrl: null, sort: i }
}

export const placeholderCategories = (n = 5): Category[] => Array.from({ length: n }, (_, i) => placeholderCategory(i))

export function placeholderCard(i = 0): ProductCardData {
  const category = placeholderCategory(i)
  return {
    id: `ph-product-${i}`,
    slug: `ph-product-${i}`,
    name: NAMES[i % NAMES.length],
    price: 1299,
    compareAtPrice: null,
    images: [],
    stock: 12,
    category: { name: category.name, slug: category.slug },
  }
}

export const placeholderCards = (n = 8): ProductCardData[] => Array.from({ length: n }, (_, i) => placeholderCard(i))

export const placeholderListItems = (n = 8): ProductListItem[] =>
  placeholderCards(n).map((c, i) => ({ ...c, isFeatured: false, createdAt: "2026-01-01T00:00:00.000Z", searchText: `${c.name} ${i}`.toLowerCase() }))

/** A 1x1 inline image: gives photo grids (uploader, gallery) their real number of tiles without a network request. */
const BLANK_IMAGE = "data:image/gif;base64,R0lGODlhAQABAAAAACw="

export function placeholderProduct(i = 0): Product {
  return {
    ...placeholderCard(i),
    // a typical product has three photos: the uploader / gallery then render the same number of tiles as the real page
    images: [0, 1, 2].map((n) => `${BLANK_IMAGE}#${n}`), // distinct values: they are React keys
    description: "A longer description of the piece, how it is made and what makes it special. It runs over a few lines so the paragraph block has a realistic height on every screen size.",
    categoryId: `ph-cat-${i}`,
    fees: [],
    shortDescription: "One or two sentences about the piece, shown right under the price.",
    highlights: ["Handmade by skilled artisans", "Made to order in small batches", "Ships within 3 days"],
    specs: [
      { label: "Material", value: "Natural clay" },
      { label: "Size", value: "12 x 8 cm" },
      { label: "Weight", value: "250 g" },
      { label: "Care", value: "Wipe with a dry cloth" },
    ],
    careInstructions: "Wipe gently with a dry cloth.",
    isActive: true,
    isFeatured: false,
    seoTitle: null,
    seoDescription: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

export const placeholderProducts = (n = 8): Product[] => Array.from({ length: n }, (_, i) => placeholderProduct(i))

export const placeholderCategoriesWithCounts = (n = 5): (Category & { count: number })[] => placeholderCategories(n).map((c, i) => ({ ...c, count: 4 + i }))

/** Two cart lines for the cart / checkout skeleton (the real cart lives in localStorage, unknown until the browser hydrates). */
export const placeholderCartLines = (n = 2): LiveCartLine[] =>
  placeholderCards(n).map((c, i) => ({
    productId: c.id,
    slug: c.slug,
    name: c.name,
    price: c.price,
    image: null,
    quantity: i + 1,
    maxQuantity: 10,
    available: true,
    priceChanged: false,
    fees: [],
  }))

export const placeholderCategoriesWithProductCount = (n = 5): (Category & { productCount: number })[] => placeholderCategories(n).map((c, i) => ({ ...c, productCount: 3 + i }))

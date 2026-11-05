import type { Category, Product } from "./types"

/**
 * Used only in demo mode (before Supabase env vars are set) so the storefront
 * can be previewed immediately. Mirrors supabase/seed.sql.
 */
const now = "2026-01-01T00:00:00.000Z"

export const demoCategories: Category[] = [
  { id: "c1", name: "Home Decor", slug: "home-decor", description: "Handcrafted pieces that make a house feel like home.", imageUrl: null, sort: 1 },
  { id: "c2", name: "Gifts", slug: "gifts", description: "Thoughtful handmade gifts for every occasion.", imageUrl: null, sort: 2 },
  { id: "c3", name: "Candles", slug: "candles", description: "Hand-poured soy candles with natural fragrances.", imageUrl: null, sort: 3 },
  { id: "c4", name: "Wall Art", slug: "wall-art", description: "Paintings, macramé and prints for your walls.", imageUrl: null, sort: 4 },
  { id: "c5", name: "Jewellery", slug: "jewellery", description: "Handmade earrings, bracelets and necklaces.", imageUrl: null, sort: 5 },
]

const cat = (slug: string) => {
  const c = demoCategories.find((x) => x.slug === slug)!
  return { categoryId: c.id, category: { name: c.name, slug: c.slug } }
}

const base = {
  images: [] as string[],
  isActive: true,
  seoTitle: null,
  seoDescription: null,
  createdAt: now,
  updatedAt: now,
}

export const demoProducts: Product[] = [
  { ...base, id: "00000000-0000-4000-8000-000000000001", name: "Hand-painted Terracotta Vase", slug: "hand-painted-terracotta-vase", description: "A rustic terracotta vase, hand-painted with traditional motifs by artisans. Perfect for dried flowers or as a standalone accent piece. Approx. 25 cm tall.", price: 899, compareAtPrice: 1199, stock: 12, isFeatured: true, ...cat("home-decor") },
  { ...base, id: "00000000-0000-4000-8000-000000000002", name: "Macramé Wall Hanging", slug: "macrame-wall-hanging", description: "Knotted by hand from 100% cotton rope on a natural driftwood branch. Adds warm boho texture to any wall. 60 × 90 cm.", price: 1299, compareAtPrice: null, stock: 8, isFeatured: true, ...cat("wall-art") },
  { ...base, id: "00000000-0000-4000-8000-000000000003", name: "Lavender Soy Candle", slug: "lavender-soy-candle", description: "Hand-poured soy wax candle with pure lavender essential oil in a reusable glass jar. Burn time ~40 hours.", price: 449, compareAtPrice: 549, stock: 30, isFeatured: true, ...cat("candles") },
  { ...base, id: "00000000-0000-4000-8000-000000000004", name: "Personalised Name Plate", slug: "personalised-name-plate", description: "A hand-painted wooden name plate for your home entrance. Share the name you want on WhatsApp after ordering.", price: 1499, compareAtPrice: null, stock: 15, isFeatured: true, ...cat("gifts") },
  { ...base, id: "00000000-0000-4000-8000-000000000005", name: "Brass Jhumka Earrings", slug: "brass-jhumka-earrings", description: "Lightweight, handcrafted brass jhumkas with an antique finish. Nickel-free hooks.", price: 599, compareAtPrice: 799, stock: 20, isFeatured: false, ...cat("jewellery") },
  { ...base, id: "00000000-0000-4000-8000-000000000006", name: "Madhubani Art Print", slug: "madhubani-art-print", description: "A4 archival print of an original Madhubani painting, signed by the artist. Frame not included.", price: 699, compareAtPrice: null, stock: 25, isFeatured: false, ...cat("wall-art") },
  { ...base, id: "00000000-0000-4000-8000-000000000007", name: "Gift Hamper — Little Joys", slug: "gift-hamper-little-joys", description: "A curated hamper with a mini soy candle, handmade soap, a block-printed pouch and a handwritten note.", price: 1899, compareAtPrice: 2299, stock: 10, isFeatured: true, ...cat("gifts") },
  { ...base, id: "00000000-0000-4000-8000-000000000008", name: "Jute & Cotton Table Runner", slug: "jute-cotton-table-runner", description: "Handwoven jute and cotton table runner with tassel ends. 180 × 35 cm.", price: 799, compareAtPrice: null, stock: 14, isFeatured: false, ...cat("home-decor") },
]

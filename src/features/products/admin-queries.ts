import "server-only"
import { z } from "zod"
import { requireAdmin } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import {
  mapCategory,
  mapProduct,
  PRODUCT_SELECT,
  type Category,
  type CategoryRow,
  type Product,
  type ProductRow,
} from "./types"

/** Admin reads are uncached and include inactive products (RLS allows admins). */
export async function listAllProducts(): Promise<Product[]> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .order("created_at", { ascending: false })
    .returns<ProductRow[]>()
  if (error) throw new Error(error.message)
  return data.map(mapProduct)
}

export async function getProductForEdit(id: string): Promise<Product | null> {
  await requireAdmin()
  if (!z.uuid().safeParse(id).success) return null
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle<ProductRow>()
  if (error) throw new Error(error.message)
  return data ? mapProduct(data) : null
}

export async function listAllCategories(): Promise<(Category & { productCount: number })[]> {
  await requireAdmin()
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("categories")
    .select("*, products(count)")
    .order("sort")
    .returns<(CategoryRow & { products: { count: number }[] })[]>()
  if (error) throw new Error(error.message)
  return data.map((row) => ({ ...mapCategory(row), productCount: row.products[0]?.count ?? 0 }))
}

import "server-only"
import { requireUser } from "@/features/auth/guards"
import { getServerSupabase } from "@/lib/supabase/server"
import { mapOrder, mapOrderWithHistory, type Order, type OrderRow, type OrderWithHistory } from "./types"

const WITH_HISTORY = "*, history:order_status_history(status, changed_at), returns:order_returns(id, items, reason, refunded, created_at)"

/** Orders of the signed-in customer. RLS also limits rows to auth.uid(). */
export async function getMyOrders(): Promise<Order[]> {
  const user = await requireUser("/account/orders")
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<OrderRow[]>()
  if (error) throw new Error(error.message)
  return data.map(mapOrder)
}

export async function getMyOrder(code: string): Promise<OrderWithHistory | null> {
  const user = await requireUser(`/account/orders/${code}`)
  const supabase = await getServerSupabase()
  const { data, error } = await supabase
    .from("orders")
    .select(WITH_HISTORY)
    .eq("user_id", user.id)
    .eq("order_code", code.toUpperCase())
    .maybeSingle<OrderRow>()
  if (error) throw new Error(error.message)
  return data ? mapOrderWithHistory(data) : null
}

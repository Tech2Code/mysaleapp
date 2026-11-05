"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { assertAdmin } from "@/features/auth/guards"
import { fail, type ActionResult } from "@/lib/action-result"
import { getServerSupabase } from "@/lib/supabase/server"
import { ORDER_STATUSES } from "./types"

const updateStatusSchema = z.object({
  orderId: z.uuid(),
  status: z.enum(ORDER_STATUSES),
})

export async function updateOrderStatus(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = updateStatusSchema.safeParse(input)
  if (!parsed.success) return fail("Invalid status")

  const supabase = await getServerSupabase()
  // The DB trigger writes the status-history row.
  const { error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.orderId)
  if (error) return fail("Could not update status")

  revalidatePath("/admin", "layout")
  return { ok: true }
}

const noteSchema = z.object({ orderId: z.uuid(), note: z.string().trim().max(1000) })

export async function updateAdminNote(input: unknown): Promise<ActionResult> {
  const auth = await assertAdmin()
  if (!auth.ok) return fail(auth.error)

  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) return fail("Note is too long")

  const supabase = await getServerSupabase()
  const { error } = await supabase
    .from("orders")
    .update({ admin_note: parsed.data.note || null })
    .eq("id", parsed.data.orderId)
  if (error) return fail("Could not save note")

  revalidatePath(`/admin/orders/${parsed.data.orderId}`)
  return { ok: true }
}

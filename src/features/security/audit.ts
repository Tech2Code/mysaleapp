import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

type AuditEntry = {
  actorId: string
  action: string
  targetType: "order" | "product" | "category" | "settings" | "store" | "promo_code"
  targetId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Best-effort append-only admin audit log. Never throws so a logging hiccup
 * cannot abort an already-committed admin operation.
 */
export async function logAdminAction(supabase: SupabaseClient, entry: AuditEntry): Promise<void> {
  try {
    await supabase.from("admin_audit_logs").insert({
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
    })
  } catch {
    // Intentionally swallowed: audit logging is non-blocking.
  }
}


import type { Metadata } from "next"
import { AdminAccountView } from "@/components/admin/page-views"
import { getAdminPinStatus, requireAdmin } from "@/features/auth/guards"
import { normalizeIndianPhone } from "@/lib/format"
import { cleanMetaName } from "@/lib/supabase/config"
import { getServerSupabase } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "My account" }

export default async function AdminAccountPage() {
  const user = await requireAdmin()
  const supabase = await getServerSupabase()
  const [{ data: profile }, pinStatus] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; phone: string | null }>(),
    getAdminPinStatus(),
  ])
  const meta = user.user_metadata as { full_name?: string; name?: string; phone?: string }
  const name = cleanMetaName(profile?.full_name) ?? cleanMetaName(meta.full_name) ?? cleanMetaName(meta.name) ?? ""
  const metaPhone = typeof meta.phone === "string" ? normalizeIndianPhone(meta.phone) : null
  const phone = profile?.phone?.trim() || metaPhone || ""
  return <AdminAccountView name={name} phone={phone} email={user.email ?? ""} pinStatus={pinStatus} />
}

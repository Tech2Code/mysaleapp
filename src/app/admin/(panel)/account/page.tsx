import type { Metadata } from "next"
import { AdminAccountView } from "@/components/admin/page-views"
import { requireAdmin } from "@/features/auth/guards"

export const metadata: Metadata = { title: "My account" }

export default async function AdminAccountPage() {
  const user = await requireAdmin()
  const meta = user.user_metadata as { full_name?: string; name?: string; phone?: string }
  return <AdminAccountView name={meta.full_name ?? meta.name ?? ""} phone={meta.phone ?? ""} email={user.email ?? ""} />
}

import type { Metadata } from "next"
import { AccountSettings } from "@/components/admin/account-forms"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { requireAdmin } from "@/features/auth/guards"

export const metadata: Metadata = { title: "My account" }

export default async function AdminAccountPage() {
  const user = await requireAdmin()
  const meta = user.user_metadata as { full_name?: string; name?: string; phone?: string }
  return (
    <>
      <AdminPageHeader title="My account" description="Your name, login email and password. No database access needed." />
      <AccountSettings
        name={meta.full_name ?? meta.name ?? ""}
        phone={meta.phone ?? ""}
        email={user.email ?? ""}
      />
    </>
  )
}

import type { Metadata } from "next"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { LaunchPanel } from "@/components/admin/launch-panel"
import { getLaunchOverview } from "@/features/settings/launch-queries"

export const metadata: Metadata = { title: "Data & launch" }

export default async function AdminLaunchPage() {
  const { counts, checklist } = await getLaunchOverview()
  return (
    <>
      <AdminPageHeader title="Data & launch" description="Check you're ready to go live, and clear the practice data from testing." />
      <LaunchPanel counts={counts} checklist={checklist} />
    </>
  )
}

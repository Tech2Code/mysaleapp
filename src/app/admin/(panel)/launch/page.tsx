import type { Metadata } from "next"
import { LaunchView } from "@/components/admin/page-views"
import { getLaunchOverview } from "@/features/settings/launch-queries"

export const metadata: Metadata = { title: "Data & launch" }

export default async function AdminLaunchPage() {
  const { counts, checklist } = await getLaunchOverview()
  return <LaunchView counts={counts} checklist={checklist} />
}

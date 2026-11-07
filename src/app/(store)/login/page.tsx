import type { Metadata } from "next"
import { LoginView } from "@/components/store/page-views"
import { getStoreSettings } from "@/features/settings/queries"

export const metadata: Metadata = { title: "Sign in", robots: { index: false } }

export default async function LoginPage() {
  return <LoginView shop={await getStoreSettings()} />
}

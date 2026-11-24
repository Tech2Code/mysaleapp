import type { Metadata } from "next"
import styles from "@/components/admin/admin-core.module.css"
import { getStoreSettings } from "@/features/settings/queries"
import "./admin.css"

export async function generateMetadata(): Promise<Metadata> {
  const shop = await getStoreSettings()
  return {
    title: { default: "Admin", template: `%s · Admin · ${shop.shopName}` },
    robots: { index: false, follow: false },
  }
}

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return <div data-slot="admin-layout" className={styles.adminRootLayout}>{children}</div>
}

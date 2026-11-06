import { HomeSkeleton } from "@/components/store/store-skeletons"

// Home page loading state. Every other storefront route has its own loading.tsx with a matching skeleton.
export default function Loading() {
  return <HomeSkeleton />
}

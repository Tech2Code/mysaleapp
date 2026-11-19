/** Placeholder data for loading states (see components/shared/skeletonize.tsx). */
import type { AdminPinStatus } from "./account-schema"

export const placeholderAdminPinStatus = (): AdminPinStatus => ({
  mode: "unset",
  hasPin: false,
  updatedAt: null,
  lockedUntil: null,
  unlockedAt: 0,
  manualLock: false,
})

export const placeholderAdminAccount = () => ({
  name: "Admin",
  email: "admin@example.com",
  avatarUrl: null,
  lastSignIn: "1 Jan, 10:00 am",
  pinStatus: placeholderAdminPinStatus(),
})

"use client"

import { KeyRoundIcon, Loader2Icon, LockIcon, LogOutIcon, SettingsIcon, ShieldCheckIcon, UserRoundCogIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { TextField } from "@/components/form"
import { applyClientSignOut } from "@/components/shared/auth-listener"
import { useBlockWhile, useBusySuccess } from "@/components/shared/busy-overlay"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ThemeSegmentedControl } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  disableAdminPin,
  lockAdminScreen,
  setAdminPin,
  unlockAdminWithPassword,
  verifyAdminPin,
} from "@/features/auth/account-actions"
import {
  ADMIN_PIN_WINDOW_MS,
  ADMIN_SESSION_MAX_AGE_MS,
  type AdminPinMode,
  type AdminPinStatus,
} from "@/features/auth/account-schema"
import { signOutAdmin } from "@/features/auth/actions"
import { useToastAfter } from "@/hooks/use-toast-after"
import { getBrowserSupabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { LIMITS } from "@/lib/validation"
import styles from "./admin-core.module.css"

export type AdminAccount = {
  name: string
  email: string
  avatarUrl: string | null
  lastSignIn: string | null
  lastSignInAt?: string | null
  pinStatus?: AdminPinStatus
}

const PIN_SYNC_EVENT = "kk-admin-pin-changed"
const PIN_STORAGE_KEY = "kk_admin_pin_sync"

export function notifyAdminPinChanged(next: Partial<AdminPinStatus>) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(PIN_SYNC_EVENT, { detail: next }))
  try {
    window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ ...next, ts: Date.now() }))
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function computeGateMode(
  pin: AdminPinStatus | undefined,
  lastSignInAt?: string | null,
  nowMs?: number
): "none" | "unlock" | "setup-prompt" {
  if (!pin || pin.mode === "disabled") return "none"
  if (pin.mode === "enabled" && pin.hasPin) {
    if (
      pin.manualLock ||
      !pin.unlockedAt ||
      (nowMs !== undefined && nowMs - pin.unlockedAt >= ADMIN_PIN_WINDOW_MS)
    ) {
      return "unlock"
    }
    return "none"
  }
  if (pin.mode === "unset" && nowMs !== undefined) {
    const baseTime =
      pin.unlockedAt > 0
        ? pin.unlockedAt
        : lastSignInAt
          ? Date.parse(lastSignInAt) || 0
          : 0
    if (baseTime > 0 && nowMs - baseTime >= ADMIN_PIN_WINDOW_MS) {
      return "setup-prompt"
    }
  }
  return "none"
}

/** Who is signed in to the admin panel, plus quick links, 12-hour PIN lock, and 7-day Sign out. */
export function AdminAccountMenu({ account }: { account: AdminAccount }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [askSignOut, setAskSignOut] = useState(false)
  const [pinState, setPinState] = useState<AdminPinStatus>(() => ({
    mode: account.pinStatus?.mode ?? "unset",
    hasPin: account.pinStatus?.hasPin ?? false,
    updatedAt: account.pinStatus?.updatedAt ?? null,
    lockedUntil: account.pinStatus?.lockedUntil ?? null,
    unlockedAt:
      account.pinStatus?.mode === "enabled" && account.pinStatus?.hasPin
        ? (account.pinStatus.unlockedAt ?? 0)
        : account.pinStatus?.unlockedAt ||
          (account.lastSignInAt ? Date.parse(account.lastSignInAt) || 0 : 0),
    manualLock: account.pinStatus?.manualLock ?? false,
  }))
  const [gateMode, setGateMode] = useState<"none" | "unlock" | "setup-prompt">(() =>
    computeGateMode(account.pinStatus, account.lastSignInAt)
  )
  const [prevPinProp, setPrevPinProp] = useState(account.pinStatus)
  if (account.pinStatus && account.pinStatus !== prevPinProp) {
    setPrevPinProp(account.pinStatus)
    setPinState({
      ...account.pinStatus,
      unlockedAt:
        account.pinStatus.mode === "enabled" && account.pinStatus.hasPin
          ? (account.pinStatus.unlockedAt ?? 0)
          : account.pinStatus.unlockedAt ||
            (account.lastSignInAt ? Date.parse(account.lastSignInAt) || 0 : 0),
    })
    setGateMode(computeGateMode(account.pinStatus, account.lastSignInAt))
  }

  useBlockWhile(pending)
  const showSuccess = useBusySuccess()
  const later = useToastAfter(pending)
  const initial = (account.name || account.email).charAt(0).toUpperCase()

  // Listen for live PIN updates from /admin/account or other open browser tabs
  useEffect(() => {
    const applyPatch = (detail: Partial<AdminPinStatus> | null | undefined) => {
      if (!detail) return
      setPinState((prev) => ({ ...prev, ...detail }))
      if (detail.mode === "disabled") {
        setGateMode("none")
      } else if (detail.manualLock) {
        setGateMode("unlock")
      } else if (detail.manualLock === false && detail.unlockedAt && Date.now() - detail.unlockedAt < ADMIN_PIN_WINDOW_MS) {
        setGateMode("none")
      }
    }
    const onPinSync = (e: Event) => {
      applyPatch((e as CustomEvent<Partial<AdminPinStatus>>).detail)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PIN_STORAGE_KEY || !e.newValue) return
      try {
        const parsed = JSON.parse(e.newValue) as Partial<AdminPinStatus>
        applyPatch(parsed)
      } catch {
        // Ignore malformed storage payload
      }
    }
    window.addEventListener(PIN_SYNC_EVENT, onPinSync)
    window.addEventListener("storage", onStorage)
    return () => {
      window.removeEventListener(PIN_SYNC_EVENT, onPinSync)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  // 7-day hard session expiry
  useEffect(() => {
    if (!account.lastSignInAt) return
    const signedInAt = Date.parse(account.lastSignInAt)
    if (Number.isNaN(signedInAt)) return

    let expired = false
    let timerId: number | null = null

    const expireSession = () => {
      if (expired) return
      expired = true
      startTransition(async () => {
        const res = await signOutAdmin("session-expired")
        applyClientSignOut()
        await getBrowserSupabase()?.auth.signOut({ scope: "local" })
        showSuccess("Session expired")
        router.replace(res.ok ? res.data.redirectTo : "/admin/login?reason=session-expired")
      })
    }

    const checkExpiry = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId)
        timerId = null
      }
      const remaining = signedInAt + ADMIN_SESSION_MAX_AGE_MS - Date.now()
      if (remaining <= 0) {
        expireSession()
        return
      }
      timerId = window.setTimeout(expireSession, Math.min(remaining, 2_147_483_647))
    }

    checkExpiry()
    const onVisible = () => {
      if (document.visibilityState === "visible") checkExpiry()
    }
    window.addEventListener("focus", checkExpiry)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      if (timerId !== null) window.clearTimeout(timerId)
      window.removeEventListener("focus", checkExpiry)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [account.lastSignInAt, later, router, showSuccess])

  // 12-hour PIN lock / first-time setup prompt
  useEffect(() => {
    if (pinState.mode === "disabled") return

    let timerId: number | null = null

    const triggerPinGate = () => {
      if (pinState.mode === "enabled" && pinState.hasPin) {
        setGateMode("unlock")
      } else if (pinState.mode === "unset") {
        setGateMode("setup-prompt")
      }
    }

    const checkPinWindow = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId)
        timerId = null
      }
      if (pinState.mode === "enabled" && pinState.hasPin) {
        if (pinState.manualLock || !pinState.unlockedAt) {
          setGateMode("unlock")
          return
        }
        const remaining = pinState.unlockedAt + ADMIN_PIN_WINDOW_MS - Date.now()
        if (remaining <= 0) {
          setGateMode("unlock")
          return
        }
        timerId = window.setTimeout(triggerPinGate, Math.min(remaining, 2_147_483_647))
        return
      }
      if (pinState.mode === "unset") {
        const baseTime =
          pinState.unlockedAt > 0
            ? pinState.unlockedAt
            : account.lastSignInAt
              ? Date.parse(account.lastSignInAt) || 0
              : 0
        if (!baseTime) return
        const remaining = baseTime + ADMIN_PIN_WINDOW_MS - Date.now()
        if (remaining <= 0) {
          setGateMode("setup-prompt")
          return
        }
        timerId = window.setTimeout(triggerPinGate, Math.min(remaining, 2_147_483_647))
      }
    }

    checkPinWindow()
    const onVisible = () => {
      if (document.visibilityState === "visible") checkPinWindow()
    }
    window.addEventListener("focus", checkPinWindow)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      if (timerId !== null) window.clearTimeout(timerId)
      window.removeEventListener("focus", checkPinWindow)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [account.lastSignInAt, pinState.hasPin, pinState.manualLock, pinState.mode, pinState.unlockedAt])

  // If any server action returns "Admin screen is locked. Enter your 4-digit PIN to continue."
  // (shown as a toast), immediately pop open the 4-digit PIN unlock dialog.
  useEffect(() => {
    if (typeof document === "undefined") return
    const checkLockedToast = () => {
      const toasts = document.querySelectorAll("[data-sonner-toast]:not([data-pin-handled])")
      for (const node of toasts) {
        if (node.textContent?.includes("Admin screen is locked")) {
          node.setAttribute("data-pin-handled", "1")
          setPinState((prev) => ({
            ...prev,
            mode: "enabled",
            hasPin: true,
            unlockedAt: 0,
            manualLock: true,
          }))
          setGateMode("unlock")
          break
        }
      }
    }
    const observer = new MutationObserver(checkLockedToast)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  const handleSignOutNow = useCallback(() => {
    startTransition(async () => {
      const res = await signOutAdmin()
      applyClientSignOut()
      await getBrowserSupabase()?.auth.signOut({ scope: "local" })
      showSuccess("Signed out")
      later(() => toast.success("Signed out"))
      router.replace(res.ok ? res.data.redirectTo : "/admin/login")
    })
  }, [later, router, showSuccess])

  const handleLockScreenNow = () => {
    startTransition(async () => {
      const res = await lockAdminScreen()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const next = { manualLock: true, unlockedAt: 0 }
      setPinState((prev) => ({ ...prev, ...next }))
      setGateMode("unlock")
      notifyAdminPinChanged(next)
      toast.info("Admin screen locked")
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger

          className={styles.accountTriggerBtn}
          aria-label={`Account: ${account.email}`}
        >
          {account.avatarUrl ? (
            <Image src={account.avatarUrl} alt="" width={36} height={36} sizes="36px" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarInitial}>{initial}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={styles.accountDropdown}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className={styles.accountLabelGroup}>
              <span className={styles.accountName}>{account.name}</span>
              <span className={styles.accountEmail}>{account.email}</span>
              <span className={styles.accountRolePill}>
                <ShieldCheckIcon className={styles.icon12} aria-hidden /> Administrator
              </span>
              {account.lastSignIn && <span className={styles.accountSignInTime}>Signed in {account.lastSignIn}</span>}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/admin/account")}>
            <UserRoundCogIcon /> My account & PIN
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/admin/settings")}>
            <SettingsIcon /> Store settings
          </DropdownMenuItem>
          {pinState.mode === "enabled" && pinState.hasPin && (
            <DropdownMenuItem disabled={pending} onClick={handleLockScreenNow}>
              <LockIcon /> Lock screen now
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className={styles.mobileOnlySep} />
          <div className={styles.mobileThemeSection}>
            <p className={styles.mobileThemeLabel}>
              Settings · Theme
            </p>
            <ThemeSegmentedControl />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => setAskSignOut(true)}>
            <LogOutIcon /> {pending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
        <ConfirmDialog
          open={askSignOut}
          onOpenChange={setAskSignOut}
          title="Sign out?"
          description="You will need to sign in again with your email and password to use the admin panel."
          confirmLabel="Sign out"
          destructive
          pending={pending}
          onConfirm={handleSignOutNow}
        />
      </DropdownMenu>

      <AdminPinGateDialog
        key={gateMode}
        gateMode={gateMode}
        email={account.email}
        onUnlocked={(next) => {
          setPinState((prev) => ({
            ...prev,
            ...next,
            manualLock: false,
          }))
          setGateMode("none")
          notifyAdminPinChanged({ ...next, manualLock: false })
          router.refresh()
        }}
        onSignOut={handleSignOutNow}
      />
    </>
  )
}

function AdminPinGateDialog({
  gateMode,
  email,
  onUnlocked,
  onSignOut,
}: {
  gateMode: "none" | "unlock" | "setup-prompt"
  email: string
  onUnlocked: (next: { unlockedAt: number; mode?: AdminPinMode; hasPin?: boolean }) => void
  onSignOut: () => void
}) {
  const [pending, startTransition] = useTransition()
  useBlockWhile(pending)
  const later = useToastAfter(pending)

  const [pin, setPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")
  const [pinError, setPinError] = useState<string | null>(null)
  const [confirmPinError, setConfirmPinError] = useState<string | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  const [forgotMode, setForgotMode] = useState(false)
  const [password, setPassword] = useState("")
  const [recoveryAction, setRecoveryAction] = useState<"unlock" | "reset" | "disable">("reset")
  const [newPin, setNewPin] = useState("")
  const [newPinConfirm, setNewPinConfirm] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [newPinError, setNewPinError] = useState<string | null>(null)
  const [newPinConfirmError, setNewPinConfirmError] = useState<string | null>(null)

  const submitPinUnlock = (pinValue: string) => {
    if (!/^\d{4}$/.test(pinValue)) {
      setPinError("Enter your 4-digit PIN")
      return
    }
    setPinError(null)
    startTransition(async () => {
      const res = await verifyAdminPin({ pin: pinValue })
      if (!res.ok) {
        setPin("")
        setPinError(res.error)
        toast.error(res.error)
        queueMicrotask(() => pinInputRef.current?.focus())
        return
      }
      later(() => toast.success("Admin panel unlocked"))
      onUnlocked({ unlockedAt: res.data.unlockedAt, mode: "enabled", hasPin: true })
    })
  }

  const submitFirstTimeSetup = (e: React.FormEvent) => {
    e.preventDefault()
    setPinError(null)
    setConfirmPinError(null)
    if (!/^\d{4}$/.test(pin)) {
      setPinError("Enter a 4-digit numeric PIN")
      return
    }
    if (pin !== confirmPin) {
      setConfirmPinError("PINs don't match")
      return
    }
    startTransition(async () => {
      const res = await setAdminPin({ pin, confirm: confirmPin })
      if (!res.ok) {
        setPinError(res.fieldErrors?.pin?.[0] ?? null)
        setConfirmPinError(res.fieldErrors?.confirm?.[0] ?? null)
        toast.error(res.error)
        return
      }
      later(() => toast.success("4-digit PIN enabled"))
      onUnlocked({ unlockedAt: res.data.unlockedAt, mode: "enabled", hasPin: true })
    })
  }

  const handleSkipPinSetup = () => {
    startTransition(async () => {
      const res = await disableAdminPin()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      later(() => toast.info("PIN lock turned off. You can enable it anytime in My account."))
      onUnlocked({ unlockedAt: res.data.unlockedAt, mode: "disabled", hasPin: false })
    })
  }

  const submitPasswordRecovery = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setNewPinError(null)
    setNewPinConfirmError(null)
    if (!password) {
      setPasswordError("Enter your account password")
      return
    }
    if (recoveryAction === "reset") {
      if (!/^\d{4}$/.test(newPin)) {
        setNewPinError("Enter a new 4-digit PIN")
        return
      }
      if (newPin !== newPinConfirm) {
        setNewPinConfirmError("New PINs don't match")
        return
      }
    }
    startTransition(async () => {
      const res = await unlockAdminWithPassword({
        password,
        action: recoveryAction,
        newPin: recoveryAction === "reset" ? newPin : undefined,
        confirmPin: recoveryAction === "reset" ? newPinConfirm : undefined,
      })
      if (!res.ok) {
        setPasswordError(res.fieldErrors?.password?.[0] ?? null)
        setNewPinError(res.fieldErrors?.newPin?.[0] ?? null)
        setNewPinConfirmError(res.fieldErrors?.confirmPin?.[0] ?? null)
        toast.error(res.error)
        return
      }
      const message =
        recoveryAction === "reset"
          ? "New 4-digit PIN saved & unlocked"
          : recoveryAction === "disable"
            ? "PIN lock turned off & unlocked"
            : "Admin panel unlocked"
      later(() => toast.success(message))
      onUnlocked({
        unlockedAt: res.data.unlockedAt,
        mode: res.data.mode,
        hasPin: res.data.mode === "enabled",
      })
    })
  }

  if (gateMode === "none") return null

  return (
    <>
      <div

        data-admin-pin-locked=""
        aria-hidden
        className={styles.pinLockBackdrop}
      />
      <Dialog open onOpenChange={() => {}}>
        <DialogContent showCloseButton={false} className={styles.pinDialogContent}>
        {gateMode === "setup-prompt" ? (
          <form onSubmit={submitFirstTimeSetup} noValidate className={styles.pinDialogForm}>
            <DialogHeader showCloseButton={false}>
              <div className={styles.pinHeaderRow}>
                <KeyRoundIcon className={styles.icon20} aria-hidden />
                <DialogTitle>Set a 4-digit Quick PIN?</DialogTitle>
              </div>
              <DialogDescription>
                You&apos;ve been signed in for 12 hours. Set a 4-digit PIN for quick 12-hour unlocks during your 7-day session, or choose &ldquo;Don&apos;t use PIN&rdquo; to stay unlocked.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className={styles.twoColGrid3}>
                <TextField
                  label="4-digit PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value)
                    setPinError(null)
                  }}
                  error={pinError ?? undefined}
                />
                <TextField
                  label="Confirm PIN"
                  kind="adminPin"
                  fieldSize="md"
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value)
                    setConfirmPinError(null)
                  }}
                  error={
                    confirmPinError ??
                    (pin.length === 4 && confirmPin.length === 4 && pin !== confirmPin
                      ? "PINs don't match"
                      : undefined)
                  }
                />
              </div>
            </DialogBody>
            <DialogFooter className={styles.pinDialogFooter}>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={handleSkipPinSetup}
                className={styles.roundedFullBtn}
              >
                Don&apos;t use PIN
              </Button>
              <Button
                type="submit"
                disabled={pending || pin.length !== 4 || confirmPin.length !== 4}
                className={styles.roundedFullBtn}
              >
                {pending && <Loader2Icon className={styles.spinIcon} />} Save 4-digit PIN
              </Button>
            </DialogFooter>
          </form>
        ) : !forgotMode ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submitPinUnlock(pin)
            }}
            noValidate
            className={styles.pinDialogForm}
          >
            <DialogHeader showCloseButton={false}>
              <div className={styles.pinHeaderRow}>
                <LockIcon className={styles.icon20} aria-hidden />
                <DialogTitle>Admin screen locked</DialogTitle>
              </div>
              <DialogDescription>
                Signed in as <span className={styles.emailHighlight}>{email}</span>. Enter your 4-digit PIN to continue for the next 12 hours.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <TextField
                ref={pinInputRef}
                label="4-digit PIN"
                kind="adminPin"
                fieldSize="lg"
                placeholder="••••"
                autoFocus
                value={pin}
                error={pinError ?? undefined}
                onChange={(e) => {
                  const val = e.target.value
                  setPin(val)
                  setPinError(null)
                  if (val.length === 4 && !pending) {
                    submitPinUnlock(val)
                  }
                }}
              />
              <div className={styles.forgotPinRow}>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true)
                    setPasswordError(null)
                    setNewPinError(null)
                    setNewPinConfirmError(null)
                  }}
                  className={styles.textPrimaryLinkBtn}
                >
                  Forgot PIN? Unlock or reset with password
                </button>
              </div>
            </DialogBody>
            <DialogFooter className={styles.pinDialogFooter}>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onSignOut}
                className={styles.roundedFullBtn}
              >
                <LogOutIcon /> Sign out
              </Button>
              <Button
                type="submit"
                disabled={pending || pin.length !== 4}
                className={styles.roundedFullBtn}
              >
                {pending && <Loader2Icon className={styles.spinIcon} />} Unlock
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form onSubmit={submitPasswordRecovery} noValidate className={styles.pinDialogForm}>
            <DialogHeader showCloseButton={false}>
              <div className={styles.pinHeaderRow}>
                <KeyRoundIcon className={styles.icon20} aria-hidden />
                <DialogTitle>Unlock or reset PIN with password</DialogTitle>
              </div>
              <DialogDescription>
                Verify your account password for <span className={styles.emailHighlight}>{email}</span> to set a new PIN, unlock, or turn PIN lock off.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <TextField
                label="Account password"
                type="password"
                fieldSize="md"
                autoComplete="current-password"
                maxLength={LIMITS.password.max}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPasswordError(null)
                }}
                error={passwordError ?? undefined}
              />
              <div className={styles.recoveryOptionsWrap}>
                <span className={styles.recoveryLabel}>After verifying password:</span>
                <div className={styles.recoveryTabsGrid}>
                  {(
                    [
                      { id: "reset", label: "Set new PIN" },
                      { id: "unlock", label: "Unlock only" },
                      { id: "disable", label: "Don't use PIN" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={recoveryAction === item.id}
                      onClick={() => {
                        setRecoveryAction(item.id)
                        setPasswordError(null)
                        setNewPinError(null)
                        setNewPinConfirmError(null)
                      }}
                      className={cn(
                        styles.recoveryTabBtn,
                        recoveryAction === item.id && styles.recoveryTabActive
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {recoveryAction === "reset" && (
                <div className={styles.twoColGrid3}>
                  <TextField
                    label="New 4-digit PIN"
                    kind="adminPin"
                    fieldSize="md"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => {
                      setNewPin(e.target.value)
                      setNewPinError(null)
                    }}
                    error={newPinError ?? undefined}
                  />
                  <TextField
                    label="Confirm new PIN"
                    kind="adminPin"
                    fieldSize="md"
                    placeholder="••••"
                    value={newPinConfirm}
                    onChange={(e) => {
                      setNewPinConfirm(e.target.value)
                      setNewPinConfirmError(null)
                    }}
                    error={
                      newPinConfirmError ??
                      (newPin.length === 4 && newPinConfirm.length === 4 && newPin !== newPinConfirm
                        ? "New PINs don't match"
                        : undefined)
                    }
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter className={styles.pinDialogFooter}>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setForgotMode(false)
                  setPasswordError(null)
                  setNewPinError(null)
                  setNewPinConfirmError(null)
                }}
                className={styles.roundedFullBtn}
              >
                Back to PIN
              </Button>
              <Button type="submit" disabled={pending || !password} className={styles.roundedFullBtn}>
                {pending && <Loader2Icon className={styles.spinIcon} />}
                {recoveryAction === "reset"
                  ? "Save new PIN & unlock"
                  : recoveryAction === "disable"
                    ? "Turn off PIN & unlock"
                    : "Unlock now"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}

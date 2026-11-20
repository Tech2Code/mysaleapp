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
import { LIMITS } from "@/lib/validation"

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
      account.pinStatus?.unlockedAt ||
      (account.lastSignInAt ? Date.parse(account.lastSignInAt) || 0 : 0),
    manualLock: account.pinStatus?.manualLock ?? false,
  }))
  const [prevPinProp, setPrevPinProp] = useState(account.pinStatus)
  if (account.pinStatus && account.pinStatus !== prevPinProp) {
    setPrevPinProp(account.pinStatus)
    setPinState(account.pinStatus)
  }

  const [gateMode, setGateMode] = useState<"none" | "unlock" | "setup-prompt">(() =>
    account.pinStatus?.manualLock && account.pinStatus.mode === "enabled" && account.pinStatus.hasPin
      ? "unlock"
      : "none"
  )

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
        later(() => toast.info("Your 7-day admin session has expired. Please sign in again."))
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
    if (!account.lastSignInAt) return
    if (pinState.mode === "disabled") return

    const baseTime =
      pinState.unlockedAt > 0
        ? pinState.unlockedAt
        : Date.parse(account.lastSignInAt) || 0
    if (!baseTime && !pinState.manualLock) return

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
      if (pinState.manualLock && pinState.mode === "enabled" && pinState.hasPin) {
        setGateMode("unlock")
        return
      }
      const remaining = baseTime + ADMIN_PIN_WINDOW_MS - Date.now()
      if (remaining <= 0) {
        triggerPinGate()
        return
      }
      timerId = window.setTimeout(triggerPinGate, Math.min(remaining, 2_147_483_647))
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
          data-ui="admin/AdminAccountMenu/DropdownMenuTrigger-grid"
          className="grid size-9 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-primary/20 transition hover:ring-primary/50"
          aria-label={`Account: ${account.email}`}
        >
          {account.avatarUrl ? (
            <Image data-ui="admin/AdminAccountMenu/Image" src={account.avatarUrl} alt="" width={36} height={36} className="size-full object-cover" />
          ) : (
            <span data-ui="admin/AdminAccountMenu/span" className="text-sm leading-none font-semibold text-primary">{initial}</span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent data-ui="admin/AdminAccountMenu/DropdownMenuContent" align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="space-y-1 py-2">
              <span data-ui="admin/AdminAccountMenu/span-2" className="block truncate text-sm font-semibold text-foreground">{account.name}</span>
              <span data-ui="admin/AdminAccountMenu/span-3" className="block truncate">{account.email}</span>
              <span data-ui="admin/AdminAccountMenu/span-inline-flex" className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-semibold text-primary">
                <ShieldCheckIcon className="size-3" aria-hidden /> Administrator
              </span>
              {account.lastSignIn && <span data-ui="admin/AdminAccountMenu/span-4" className="block pt-1 text-[0.7rem]">Signed in {account.lastSignIn}</span>}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem" onClick={() => router.push("/admin/account")}>
            <UserRoundCogIcon /> My account & PIN
          </DropdownMenuItem>
          <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem-2" onClick={() => router.push("/admin/settings")}>
            <SettingsIcon /> Store settings
          </DropdownMenuItem>
          {pinState.mode === "enabled" && pinState.hasPin && (
            <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem-3" disabled={pending} onClick={handleLockScreenNow}>
              <LockIcon /> Lock screen now
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem data-ui="admin/AdminAccountMenu/DropdownMenuItem-4" variant="destructive" disabled={pending} onClick={() => setAskSignOut(true)}>
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
        data-ui="admin/AdminPinGateDialog/div-fixed"
        data-admin-pin-locked=""
        aria-hidden
        className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl"
      />
      <Dialog open onOpenChange={() => {}}>
        <DialogContent data-ui="admin/AdminPinGateDialog/DialogContent" showCloseButton={false} className="sm:max-w-md">
        {gateMode === "setup-prompt" ? (
          <form data-ui="admin/AdminPinGateDialog/form-flex" onSubmit={submitFirstTimeSetup} noValidate className="flex flex-col">
            <DialogHeader showCloseButton={false}>
              <div data-ui="admin/AdminPinGateDialog/div-flex" className="flex items-center gap-2 text-primary">
                <KeyRoundIcon className="size-5 shrink-0" aria-hidden />
                <DialogTitle>Set a 4-digit Quick PIN?</DialogTitle>
              </div>
              <DialogDescription>
                You&apos;ve been signed in for 12 hours. Set a 4-digit PIN for quick 12-hour unlocks during your 7-day session, or choose &ldquo;Don&apos;t use PIN&rdquo; to stay unlocked.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div data-ui="admin/AdminPinGateDialog/div-grid" className="grid gap-3 sm:grid-cols-2">
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
            <DialogFooter className="sm:justify-between">
              <Button data-ui="admin/AdminPinGateDialog/Button-don-apos-t-use-pin"
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={handleSkipPinSetup}
                className="rounded-full"
              >
                Don&apos;t use PIN
              </Button>
              <Button data-ui="admin/AdminPinGateDialog/Button-save-4-digit-pin"
                type="submit"
                disabled={pending || pin.length !== 4 || confirmPin.length !== 4}
                className="rounded-full"
              >
                {pending && <Loader2Icon className="animate-spin" />} Save 4-digit PIN
              </Button>
            </DialogFooter>
          </form>
        ) : !forgotMode ? (
          <form data-ui="admin/AdminPinGateDialog/form-flex-2"
            onSubmit={(e) => {
              e.preventDefault()
              submitPinUnlock(pin)
            }}
            noValidate
            className="flex flex-col"
          >
            <DialogHeader showCloseButton={false}>
              <div data-ui="admin/AdminPinGateDialog/div-flex-2" className="flex items-center gap-2 text-primary">
                <LockIcon className="size-5 shrink-0" aria-hidden />
                <DialogTitle>Admin screen locked</DialogTitle>
              </div>
              <DialogDescription>
                Signed in as <span data-ui="admin/AdminPinGateDialog/span" className="font-medium text-foreground">{email}</span>. Enter your 4-digit PIN to continue for the next 12 hours.
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
              <div data-ui="admin/AdminPinGateDialog/div-flex-3" className="flex items-center justify-between pt-1">
                <button data-ui="admin/AdminPinGateDialog/button-forgot-pin-unlock-or-r"
                  type="button"
                  onClick={() => {
                    setForgotMode(true)
                    setPasswordError(null)
                    setNewPinError(null)
                    setNewPinConfirmError(null)
                  }}
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Forgot PIN? Unlock or reset with password
                </button>
              </div>
            </DialogBody>
            <DialogFooter className="sm:justify-between">
              <Button data-ui="admin/AdminPinGateDialog/Button-sign-out"
                type="button"
                variant="outline"
                disabled={pending}
                onClick={onSignOut}
                className="rounded-full"
              >
                <LogOutIcon /> Sign out
              </Button>
              <Button data-ui="admin/AdminPinGateDialog/Button-unlock"
                type="submit"
                disabled={pending || pin.length !== 4}
                className="rounded-full"
              >
                {pending && <Loader2Icon className="animate-spin" />} Unlock
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form data-ui="admin/AdminPinGateDialog/form-flex-3" onSubmit={submitPasswordRecovery} noValidate className="flex flex-col">
            <DialogHeader showCloseButton={false}>
              <div data-ui="admin/AdminPinGateDialog/div-flex-4" className="flex items-center gap-2 text-primary">
                <KeyRoundIcon className="size-5 shrink-0" aria-hidden />
                <DialogTitle>Unlock or reset PIN with password</DialogTitle>
              </div>
              <DialogDescription>
                Verify your account password for <span data-ui="admin/AdminPinGateDialog/span-2" className="font-medium text-foreground">{email}</span> to set a new PIN, unlock, or turn PIN lock off.
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
              <div data-ui="admin/AdminPinGateDialog/div" className="space-y-1.5">
                <span data-ui="admin/AdminPinGateDialog/span-3" className="block text-xs font-medium text-muted-foreground">After verifying password:</span>
                <div data-ui="admin/AdminPinGateDialog/div-grid-2" className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1">
                  {(
                    [
                      { id: "reset", label: "Set new PIN" },
                      { id: "unlock", label: "Unlock only" },
                      { id: "disable", label: "Don't use PIN" },
                    ] as const
                  ).map((item) => (
                    <button data-ui="admin/AdminPinGateDialog/button"
                      key={item.id}
                      type="button"
                      aria-pressed={recoveryAction === item.id}
                      onClick={() => {
                        setRecoveryAction(item.id)
                        setPasswordError(null)
                        setNewPinError(null)
                        setNewPinConfirmError(null)
                      }}
                      className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        recoveryAction === item.id
                          ? "bg-background text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              {recoveryAction === "reset" && (
                <div data-ui="admin/AdminPinGateDialog/div-grid-3" className="grid gap-3 sm:grid-cols-2">
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
            <DialogFooter className="sm:justify-between">
              <Button data-ui="admin/AdminPinGateDialog/Button-back-to-pin"
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setForgotMode(false)
                  setPasswordError(null)
                  setNewPinError(null)
                  setNewPinConfirmError(null)
                }}
                className="rounded-full"
              >
                Back to PIN
              </Button>
              <Button data-ui="admin/AdminPinGateDialog/Button" type="submit" disabled={pending || !password} className="rounded-full">
                {pending && <Loader2Icon className="animate-spin" />}
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
